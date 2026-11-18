import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { unlinkSync } from 'fs';
import { ItinerariesService } from './itineraries.service';
import { ItineraryDaysService } from './itinerary-days.service';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';
import { toItineraryView } from './itinerary.view';
import { UserDocument } from '../users/schemas/user.schema';
import { UploadsService } from '../uploads/uploads.service';
import { MAX_IMAGES_PER_ITEM } from '../uploads/uploads.constants';

const idOf = (x: unknown) => String((x as { _id: unknown })._id);

@Injectable()
export class ItineraryActivitiesService {
  constructor(
    private readonly its: ItinerariesService,
    private readonly days: ItineraryDaysService,
    private readonly uploads: UploadsService,
  ) {}

  /** ITN-10: add an activity to one day of my itinerary. */
  async add(user: UserDocument, id: string, dayId: string, dto: CreateActivityDto) {
    const it = await this.its.getOwned(user, id);
    const day = this.days.dayOf(it, dayId);
    day.activities.push({
      name: dto.name,
      description: dto.description,
      time: dto.time,
      cost: dto.cost,
      costCurrency: dto.costCurrency ?? 'USD',
      images: [],
    });
    await it.save();
    return toItineraryView(it);
  }

  /**
   * Finds an activity by its own id inside MY itineraries only. Someone else's activity and a
   * missing one look the same (404), so nobody can probe which ids exist (ACC-11).
   */
  private async locate(user: UserDocument, activityId: string) {
    if (!isValidObjectId(activityId)) throw new NotFoundException('Activity not found');
    const it = await this.its.model.findOne({ user: user._id, 'days.activities._id': activityId });
    if (it) {
      for (const day of it.days) {
        const idx = day.activities.findIndex((a) => idOf(a) === activityId);
        if (idx >= 0) return { it, day, idx, activity: day.activities[idx] };
      }
    }
    throw new NotFoundException('Activity not found');
  }

  async update(user: UserDocument, activityId: string, dto: UpdateActivityDto) {
    const { it, activity } = await this.locate(user, activityId);
    if (dto.name !== undefined) activity.name = dto.name;
    if (dto.description !== undefined) activity.description = dto.description;
    if (dto.time !== undefined) activity.time = dto.time;
    if (dto.cost !== undefined) activity.cost = dto.cost;
    if (dto.costCurrency !== undefined) activity.costCurrency = dto.costCurrency;
    await it.save();
    return toItineraryView(it);
  }

  async remove(user: UserDocument, activityId: string) {
    const { it, day, idx } = await this.locate(user, activityId);
    day.activities.splice(idx, 1); // image files stay on disk: clones of a public itinerary can share the same URLs
    await it.save();
    return toItineraryView(it);
  }

  /** ITN-12, GEN-08: up to 5 JPG/PNG images per activity (type, size and signature checks are in the upload service). */
  async addImages(user: UserDocument, activityId: string, files: Express.Multer.File[]) {
    const cleanup = () =>
      (files ?? []).forEach((f) => {
        try {
          unlinkSync(f.path);
        } catch {
          /* ignore */
        }
      }); // remove what multer already saved
    let found: Awaited<ReturnType<ItineraryActivitiesService['locate']>>;
    try {
      found = await this.locate(user, activityId);
    } catch (e) {
      cleanup();
      throw e;
    }
    const { it, activity } = found;
    if (activity.images.length + (files?.length ?? 0) > MAX_IMAGES_PER_ITEM) {
      cleanup();
      throw new BadRequestException(`An activity can have at most ${MAX_IMAGES_PER_ITEM} images`);
    }
    const urls = this.uploads.processImages(files);
    activity.images.push(...urls.map((url) => ({ url })));
    await it.save();
    return toItineraryView(it);
  }

  async removeImage(user: UserDocument, activityId: string, imageId: string) {
    const { it, activity } = await this.locate(user, activityId);
    const i = activity.images.findIndex((img) => idOf(img) === imageId);
    if (i < 0) throw new NotFoundException('Image not found on this activity');
    activity.images.splice(i, 1);
    await it.save();
    return toItineraryView(it);
  }
}