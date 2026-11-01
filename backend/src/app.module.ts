import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';

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

    UsersModule,

    AuthModule,

    NotificationsModule,

    AuditModule,

    ReferenceDataModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}