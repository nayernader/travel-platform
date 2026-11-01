import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      // Errors we throw on purpose (NotFoundException, validation, etc.)
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        error = (b.error as string) ?? exception.name;
      }
    } else if ((exception as { code?: number })?.code === 11000) {
      // MongoDB duplicate key (for example, an email that already exists)
      status = HttpStatus.CONFLICT;
      message = 'A record with this value already exists';
      error = 'Conflict';
    } else if ((exception as { name?: string })?.name === 'CastError') {
      // Invalid MongoDB id format
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid id format';
      error = 'Bad Request';
    } else {
      // Unexpected bug: log it, but don't leak details to the client
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}