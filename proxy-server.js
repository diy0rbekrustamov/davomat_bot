const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

function startApp() {
  const app = express();
  
  app.use('/api', createProxyMiddleware({ 
    target: 'http://localhost:3000', 
    changeOrigin: true,
    pathRewrite: { '^/': '/api/' }
  }));
  
  app.use('/uploads', createProxyMiddleware({ 
    target: 'http://localhost:3000', 
    changeOrigin: true,
    pathRewrite: { '^/': '/uploads/' }
  }));

  const adminDist = path.join(__dirname, 'apps', 'admin-panel', 'dist');
  const teacherDist = path.join(__dirname, 'apps', 'teacher-app', 'dist');

  // Serve teacher app on /teacher
  app.use('/teacher', express.static(teacherDist));
  app.get('/teacher/*', (req, res) => res.sendFile(path.join(teacherDist, 'index.html')));

  // Serve admin app on /
  app.use(express.static(adminDist));
  app.get('/*', (req, res) => {
    if (req.path.startsWith('/teacher') || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return;
    }
    res.sendFile(path.join(adminDist, 'index.html'));
  });

  app.listen(4000, () => {
    console.log('Barcha frontendlar port 4000 da yondi');
  });
}

startApp();
