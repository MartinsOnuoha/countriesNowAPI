/* eslint-disable no-unused-expressions */
/* eslint-disable no-nested-ternary */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');
const swaggerUi = require('swagger-ui-express');
const corsConfig = require('./config/cors');

const indexRouter = require('./routes/index');
const countryRouter = require('./routes/countries');

const app = express();

const openApiDocumentation = require('./swagger/openApiDocumentation');

app.use('/swagger-docs', swaggerUi.serve, swaggerUi.setup(openApiDocumentation));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
  }),
);

/*                                                                                        *
 * Cors is enabled so the client can acces enpoint on this API wthout having to make request *
 *  from the same Origin
 */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsConfig.origins);
  res.header('Access-Control-Allow-Headers', corsConfig.headers);
  if (req.method === 'OPTIONS') {
    // preflight request
    res.header('Access-Control-Allow-Methods', corsConfig.methods);
    return res.status(200).json({});
  }
  next();
  return true;
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
  next();
});

app.use('/', indexRouter);
app.use('/api/v0.1/countries', countryRouter);

// catch 404 and forward to error handler
app.use((req, res) => res.status(404).json({
  error: true,
  msg: 'you seem to be lost',
}));

// set port depending on environment
let port;
const environment = app.get('env');

environment === 'development' ? port = 3000 || process.env.PORT
  : environment === 'test' ? port = process.env.TEST_PORT
    : port = process.env.PORT;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on port ${port}`);
});

module.exports = app;
