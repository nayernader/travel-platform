import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PolicyAcceptance, PolicyAcceptanceSchema } from './schemas/policy-acceptance.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Refund, RefundSchema } from './schemas/refund.schema';
import { FlightBookingsModule } from '../flight-bookings/flight-bookings.module';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
import { BookingPort } from './booking-port.service';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { stripeProvider } from './stripe.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PolicyAcceptance.name, schema: PolicyAcceptanceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
    ]),
    FlightBookingsModule,
    HotelBookingsModule,
  ],
  controllers: [PoliciesController, PaymentsController, RefundsController],
  providers: [BookingPort, PoliciesService, PaymentsService, RefundsService, stripeProvider],
  exports: [BookingPort, PoliciesService, PaymentsService, RefundsService],
})
export class PaymentsModule {}