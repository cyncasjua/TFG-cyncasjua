import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isMulterFileSizeError =
      exception instanceof Error && (exception as any).code === 'LIMIT_FILE_SIZE';

    const status = isMulterFileSizeError
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(
      `[${request.method} ${request.url}] HTTP ${status}`,
      exception instanceof Error ? exception.stack : String(exception)
    );

    const body = isMulterFileSizeError
      ? { statusCode: HttpStatus.PAYLOAD_TOO_LARGE, message: 'El archivo supera el tamaño máximo permitido (10 MB)' }
      : exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(body);
  }
}
