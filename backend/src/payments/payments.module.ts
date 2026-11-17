import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PolicyAcceptance, PolicyAcceptanceSchema } from './schemas/policy-acceptance.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { FlightBookingsModule } from '../flight-bookings/flight-bookings.module';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
import { BookingPort } from './booking-port.service';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { stripeProvider } from './stripe.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PolicyAcceptance.name, schema: PolicyAcceptanceSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    FlightBookingsModule,
    HotelBookingsModule,
  ],
  controllers: [PoliciesController, PaymentsController],
  providers: [BookingPort, PoliciesService, PaymentsService, stripeProvider],
  exports: [BookingPort, PoliciesService, PaymentsService],
})
export class PaymentsModule {}