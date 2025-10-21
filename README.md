# DataChat AI - Natural Language Data Analysis

A modern chatbot application that allows users to upload datasets (CSV, Excel) and interact with them using natural language prompts. The system automatically converts user prompts into SQL queries, executes them, and returns clean result tables with visualizations.

## Features

- 🤖 **AI-Powered Query Generation**: Convert natural language to SQL using advanced AI
- 📊 **Interactive Data Visualization**: Charts powered by Chart.js (bar, line, pie, doughnut, scatter)
- 📁 **Multiple File Formats**: Support for CSV and Excel files (.xlsx, .xls)
- 🔄 **Schema Caching**: Automatic schema detection and localStorage caching
- 💬 **Chat Interface**: Intuitive conversation-style data exploration
- 🎨 **Modern UI**: Dark theme inspired by Camel AI's interface
- ⚡ **Real-time Results**: Instant query execution and visualization

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with react-chartjs-2
- **Data Processing**: PapaParse (CSV), SheetJS (Excel)
- **Icons**: Lucide React
- **AI Integration**: Custom API endpoint for natural language processing

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd chatbot-dataset-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. **Upload Dataset**: Click "Upload Dataset" and select a CSV or Excel file (max 5MB)
2. **Ask Questions**: Use natural language to query your data:
   - "Show me the first 10 rows"
   - "What are the column names?"
   - "Count records by department"
   - "Show employees with salary > 70000"
   - "Average salary by department"
3. **View Results**: See results in both table and chart formats
4. **Explore Data**: Continue asking questions to explore your dataset

## Sample Queries

Try these example queries with the included sample data:

- "Show me all employees in the Engineering department"
- "What's the average salary by department?"
- "List employees hired after 2022"
- "Count how many employees are in each department"
- "Show the top 5 highest paid employees"
- "What's the age distribution of employees?"

## File Format Support

### CSV Files
- Comma-separated values
- Headers in first row
- UTF-8 encoding recommended

### Excel Files
- .xlsx and .xls formats
- First worksheet will be used
- Headers in first row

## AI Integration

The application uses a custom AI endpoint for natural language to SQL conversion:

```javascript
const API_URL = 'https://16c0c1a36195.ngrok-free.app/api/generate';
```

The AI service:
- Analyzes your natural language prompt
- Generates appropriate SQL queries
- Suggests suitable chart types for visualization
- Provides explanations for generated queries

## Architecture

```
src/
├── app/                 # Next.js app directory
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Main page component
├── components/         # React components
│   ├── ChatInterface.tsx    # Main chat interface
│   ├── ChartVisualization.tsx # Chart rendering
│   ├── DataTable.tsx        # Data table display
│   ├── FileUpload.tsx       # File upload component
│   └── Sidebar.tsx          # Navigation sidebar
├── types/              # TypeScript type definitions
│   └── index.ts
└── utils/              # Utility functions
    ├── aiService.ts    # AI integration
    └── dataProcessor.ts # Data processing
```

## Data Storage

- **Session Storage**: Dataset data stored in browser memory during session
- **Local Storage**: Schema caching for improved performance
- **No Server Storage**: All data processing happens client-side

## Performance Considerations

- File size limit: 5MB for optimal performance
- Table display limit: 100 rows (full data used for queries)
- Chart data limit: Automatic sampling for large datasets
- Schema caching reduces processing time for repeated uploads

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the GitHub issues page
- Review the documentation
- Test with the included sample data

---

Built with ❤️ using Next.js and AI-powered natural language processing.
