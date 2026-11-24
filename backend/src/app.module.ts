import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';      
import { EventEmitterModule } from '@nestjs/event-emitter';   
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { AdminModule } from './admin/admin.module';
import { AirlinesModule } from './airlines/airlines.module';
import { FlightsModule } from './flights/flights.module';
import { FlightBookingsModule } from './flight-bookings/flight-bookings.module';
import { HotelsModule } from './hotels/hotels.module';
import { HotelBookingsModule } from './hotel-bookings/hotel-bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { ItinerariesModule } from './itineraries/itineraries.module';
import { BlogModule } from './blog/blog.module';
import { UploadsModule } from './uploads/uploads.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { FavouritesModule } from './favourites/favourites.module'; // BON-02


@Module({
  imports: [
    // Loads .env and makes it available in every module
    ConfigModule.forRoot({ isGlobal: true }),

    // Connects to MongoDB Atlas using MONGODB_URI from .env
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), // default; forgot-password sets its own limit

    ScheduleModule.forRoot(),       // NEW: cron jobs (hold expiry, flight departed, daily exchange rates)
    EventEmitterModule.forRoot(),   // NEW: events (booking.refund.requested)

    UsersModule,

    AuthModule,

    NotificationsModule,

    AuditModule,

    UploadsModule,

    ReferenceDataModule,

    AdminModule,

    AirlinesModule,

    FlightsModule,

    FlightBookingsModule,

    HotelsModule,

    HotelBookingsModule,

    PaymentsModule,

    ItinerariesModule,

    BlogModule,
    ExchangeRatesModule,
    FavouritesModule, // BON-02
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
