function buildDashboardStats(books, issues) {
  const totalBooks = books.length;
  const totalQuantity = books.reduce((sum, book) => sum + Number(book.quantity || 0), 0);
  const availableBooks = books.reduce((sum, book) => sum + Number(book.available || 0), 0);
  const issuedBooks = issues.filter((issue) => issue.status === 'Issued').length;
  const returnedToday = issues.filter((issue) => issue.status === 'Returned').length;
  const totalStudents = new Set(issues.map((issue) => issue.studentId)).size;

  return {
    totalBooks,
    availableBooks,
    issuedBooks,
    returnedToday,
    totalStudents,
    totalQuantity
  };
}

function filterBooks(books, search = '') {
  const term = search.trim().toLowerCase();
  if (!term) return books;

  return books.filter((book) => {
    return [book.title, book.author, book.category, book.isbn]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });
}

function createSeedBooks(count = 260) {
  const categories = ['Programming', 'Science', 'History', 'Fiction', 'Business', 'Self-Help', 'Technology', 'Mathematics', 'Art', 'Biographies'];
  const authors = ['Ava Chen', 'Daniel Kim', 'Meera Shah', 'Liam Ortiz', 'Riya Patel', 'Noah Brooks', 'Sofia Cruz', 'Ethan Cole', 'Priya Iyer', 'Mateo Flores'];
  const books = [];

  for (let index = 1; index <= count; index += 1) {
    const category = categories[(index - 1) % categories.length];
    const author = authors[(index - 1) % authors.length];
    const title = `${category} Essentials ${index}`;
    const year = 2000 + ((index + 7) % 25);
    const quantity = 4 + (index % 8);
    books.push({
      id: `book-${index}`,
      _id: `book-${index}`,
      title,
      author,
      category,
      isbn: `978100${String(index).padStart(6, '0')}`,
      year,
      quantity,
      available: quantity
    });
  }

  return books;
}

module.exports = { buildDashboardStats, filterBooks, createSeedBooks };
