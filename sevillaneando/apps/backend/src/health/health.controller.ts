import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'sevillaneando-api',
      message: 'API de Sevillaneando funcionando correctamente.',
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
    };
  }

  @Get('favicon.ico')
  favicon(@Res() res: Response) {
    res.status(204);
    res.end();
  }

  @Get('notifications-sw.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  notificationsServiceWorker(@Res() res: Response) {
    res.status(204);
    res.end();
  }
}
