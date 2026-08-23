// Dev entry: registers Babel so Nest decorators work, then boots the app.
require('@babel/register').default({ extensions: ['.js'] });
require('./src/main.js');
