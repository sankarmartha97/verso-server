// Health module.
const { Module } = require('@nestjs/common');
const { HealthController } = require('./health.controller.js');

@Module({ controllers: [HealthController] })
class HealthModule {}

module.exports = { HealthModule };
