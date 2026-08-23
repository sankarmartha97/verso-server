// Root module.
const { Module } = require('@nestjs/common');
const { HealthModule } = require('./modules/health/health.module.js');

@Module({ imports: [HealthModule] })
class AppModule {}

module.exports = { AppModule };
