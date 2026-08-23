// Babel config so NestJS decorators + DI metadata work in plain JS.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: [
    'babel-plugin-transform-typescript-metadata',                 // emits DI metadata
    ['@babel/plugin-proposal-decorators', { version: 'legacy' }], // @Controller/@Injectable
    ['@babel/plugin-transform-class-properties'],
  ],
};
