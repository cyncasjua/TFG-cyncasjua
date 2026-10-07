import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('returns API metadata at the root endpoint', () => {
    expect(controller.root()).toMatchObject({
      status: 'ok',
      service: 'sevillaneando-api',
    });
  });

  it('returns health status', () => {
    expect(controller.health()).toMatchObject({
      status: 'ok',
    });
  });

  it('returns empty responses for browser asset requests', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    } as any;

    controller.favicon(res);
    controller.notificationsServiceWorker(res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledTimes(2);
  });
});
