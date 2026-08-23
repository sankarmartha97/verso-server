// Liveness/readiness probe.
const { Controller, Get } = require('@nestjs/common');

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'verso-server', time: new Date().toISOString() };
  }
}

module.exports = { HealthController };
