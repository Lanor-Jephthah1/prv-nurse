require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Attach io to req object so routes can access it
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Socket.io connection logic
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join a room for a specific booking chat
    socket.on('join_booking', (bookingId) => {
        socket.join(bookingId);
        console.log(`User joined booking chat: ${bookingId}`);
    });

    // Handle sending a message
    socket.on('send_message', (data) => {
        // data should contain { bookingId, text, senderId }
        // Broadcast to everyone else in the room
        socket.to(data.bookingId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected successfully'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/nurses', require('./routes/nurses'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/upload', require('./routes/upload'));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the PRV Nurse Backend API. Please query /api/health for system status.' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'Platform is running smoothly' });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}

module.exports = app;
