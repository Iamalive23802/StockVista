const express = require('express');
const cors = require('cors');
const compression = require('compression');
 const helmet = require('helmet');
const { authenticateToken } = require('./middleware/auth');

const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 5050;
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));



// Logging middleware
app.use((req, res, next) => {
  console.log(`[INCOMING] ${req.method} ${req.originalUrl}`);
  next();
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working' });
});

// Public routes
console.log('Mounting auth routes at /api/auth');
app.use('/api/auth', authRoutes);
console.log('Auth routes mounted successfully');

// Protected routes - require authentication
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/teams', authenticateToken, teamRoutes);
app.use('/api/leads', authenticateToken, leadRoutes);

// Debug: Log all registered routes
console.log('Registered routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    console.log(`Router mounted at: ${middleware.regexp}`);
  }
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  res.status(500).json({ message: 'Internal Server Error' });
});

// ✅ Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`🌐 Server accessible at http://139.59.90.124:${PORT}`);
});
