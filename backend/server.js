const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const optimizeRoutes = require('./routes/optimizeRoutes');

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

app.use('/api', optimizeRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Serving frontend from: ${frontendPath}`);
});

setInterval(() => {}, 1000 * 60 * 60);
