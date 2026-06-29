const express = require('express');
const path = require('path');
const cors = require('cors');
const { connectDB, isFallbackMode } = require('./config/db');
const Book = require('./models/Book');
const Issue = require('./models/Issue');
const { buildDashboardStats, filterBooks, createSeedBooks } = require('./utils/libraryLogic');

const app = express();
const PORT = process.env.PORT || 3000;
const SEED_COUNT = 260;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const memoryBooks = [];
const memoryIssues = [];

function findBookById(books, bookId) {
  const target = String(bookId || '').trim();
  if (!target) return null;
  return books.find((entry) => String(entry.id || entry._id || '').trim() === target);
}

function toBookPayload(book) {
  return {
    _id: book._id || book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    isbn: book.isbn,
    year: book.year,
    quantity: book.quantity,
    available: book.available
  };
}

function toIssuePayload(issue) {
  return {
    _id: issue._id || issue.id,
    studentName: issue.studentName,
    studentId: issue.studentId,
    bookTitle: issue.bookTitle,
    issueDate: issue.issueDate,
    returnDate: issue.returnDate,
    status: issue.status
  };
}

async function initializeData() {
  if (isFallbackMode()) {
    if (memoryBooks.length === 0) {
      memoryBooks.push(...createSeedBooks(SEED_COUNT));
    }
    return;
  }

  const existingCount = await Book.countDocuments();
  if (existingCount === 0) {
    const books = createSeedBooks(SEED_COUNT);
    await Book.insertMany(books);
  } else if (existingCount < 250) {
    const books = createSeedBooks(SEED_COUNT);
    const missingCount = SEED_COUNT - existingCount;
    await Book.insertMany(books.slice(0, missingCount));
  }
}

async function getBookStore() {
  if (isFallbackMode()) {
    return { books: memoryBooks, issues: memoryIssues };
  }

  const [books, issues] = await Promise.all([Book.find({}), Issue.find({})]);
  return { books, issues };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (email === 'admin@example.com' && password === 'admin123') {
    return res.json({ success: true, role: 'admin', email, name: 'Admin User' });
  }

  if (email === 'user@example.com' && password === 'user123') {
    return res.json({ success: true, role: 'user', email, name: 'Library User' });
  }

  return res.status(401).json({ message: 'Invalid login. Try admin@example.com/admin123 or user@example.com/user123.' });
});

app.get('/dashboard', async (req, res) => {
  try {
    const { books, issues } = await getBookStore();
    const stats = buildDashboardStats(books, issues);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/books', async (req, res) => {
  try {
    const { books } = await getBookStore();
    const search = req.query.search || '';
    const filtered = filterBooks(books, search);
    res.json(filtered.map(toBookPayload));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/books/:id', async (req, res) => {
  try {
    if (isFallbackMode()) {
      const book = findBookById(memoryBooks, req.params.id);
      if (!book) return res.status(404).json({ message: 'Book not found' });
      return res.json(toBookPayload(book));
    }

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(toBookPayload(book));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/books', async (req, res) => {
  try {
    const { title, author, category, isbn, year, quantity } = req.body;
    if (!title || !author || !category || !isbn || !year || !quantity) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (isFallbackMode()) {
      const existing = memoryBooks.find((book) => book.isbn === isbn);
      if (existing) return res.status(409).json({ message: 'Book with this ISBN already exists' });
      const book = {
        id: `${Date.now()}`,
        title,
        author,
        category,
        isbn,
        year: Number(year),
        quantity: Number(quantity),
        available: Number(quantity)
      };
      memoryBooks.push(book);
      return res.status(201).json(toBookPayload(book));
    }

    const existing = await Book.findOne({ isbn });
    if (existing) return res.status(409).json({ message: 'Book with this ISBN already exists' });

    const book = new Book({
      title,
      author,
      category,
      isbn,
      year: Number(year),
      quantity: Number(quantity),
      available: Number(quantity)
    });
    await book.save();
    res.status(201).json(toBookPayload(book));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/books/:id', async (req, res) => {
  try {
    const { title, author, category, isbn, year, quantity } = req.body;
    if (isFallbackMode()) {
      const index = memoryBooks.findIndex((book) => book.id === req.params.id || book._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Book not found' });
      const updated = {
        ...memoryBooks[index],
        title: title || memoryBooks[index].title,
        author: author || memoryBooks[index].author,
        category: category || memoryBooks[index].category,
        isbn: isbn || memoryBooks[index].isbn,
        year: Number(year || memoryBooks[index].year),
        quantity: Number(quantity || memoryBooks[index].quantity),
        available: Number(quantity || memoryBooks[index].available)
      };
      memoryBooks[index] = updated;
      return res.json(toBookPayload(updated));
    }

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    book.title = title || book.title;
    book.author = author || book.author;
    book.category = category || book.category;
    book.isbn = isbn || book.isbn;
    book.year = Number(year || book.year);
    book.quantity = Number(quantity || book.quantity);
    book.available = Number(quantity || book.available);

    await book.save();
    res.json(toBookPayload(book));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/books/:id', async (req, res) => {
  try {
    if (isFallbackMode()) {
      const index = memoryBooks.findIndex((book) => String(book.id || book._id || '') === String(req.params.id));
      if (index === -1) return res.status(404).json({ message: 'Book not found' });
      memoryBooks.splice(index, 1);
      return res.json({ message: 'Book deleted successfully' });
    }

    const result = await Book.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Book not found' });
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/issue', async (req, res) => {
  try {
    const { issues } = await getBookStore();
    res.json(issues.map(toIssuePayload));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/issue', async (req, res) => {
  try {
    const { studentName, studentId, bookId, issueDate } = req.body;
    if (!studentName || !studentId || !bookId || !issueDate) {
      return res.status(400).json({ message: 'Student, book, and issue date are required' });
    }

    if (isFallbackMode()) {
      const book = findBookById(memoryBooks, bookId);
      if (!book) return res.status(404).json({ message: 'Book not found' });
      if (book.available <= 0) return res.status(400).json({ message: 'Book is out of stock' });
      book.available -= 1;
      const issue = {
        id: `${Date.now()}`,
        studentName,
        studentId,
        bookTitle: book.title,
        issueDate,
        returnDate: '',
        status: 'Issued'
      };
      memoryIssues.push(issue);
      return res.status(201).json(toIssuePayload(issue));
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.available <= 0) return res.status(400).json({ message: 'Book is out of stock' });

    book.available -= 1;
    await book.save();

    const issue = new Issue({
      studentName,
      studentId,
      bookTitle: book.title,
      issueDate,
      returnDate: '',
      status: 'Issued'
    });
    await issue.save();
    res.status(201).json(toIssuePayload(issue));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/return/:id', async (req, res) => {
  try {
    if (isFallbackMode()) {
      const issue = memoryIssues.find((entry) => entry.id === req.params.id || entry._id === req.params.id);
      if (!issue) return res.status(404).json({ message: 'Issue record not found' });
      issue.status = 'Returned';
      issue.returnDate = new Date().toISOString().split('T')[0];
      const book = memoryBooks.find((entry) => entry.title === issue.bookTitle);
      if (book) book.available += 1;
      return res.json({ message: 'Book returned successfully' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue record not found' });

    issue.status = 'Returned';
    issue.returnDate = new Date().toISOString().split('T')[0];
    await issue.save();

    const book = await Book.findOne({ title: issue.bookTitle });
    if (book) {
      book.available += 1;
      await book.save();
    }

    res.json({ message: 'Book returned successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

connectDB().then(async () => {
  await initializeData();
  app.listen(PORT, () => {
    console.log(`Library server is running at http://localhost:${PORT}`);
  });
});
