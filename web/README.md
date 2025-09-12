# Enterprise LLM PromptOps Web Platform

## Overview

A modern, enterprise-class web application for managing LLM prompts at scale. Built with React, TypeScript, and modern web technologies, this platform provides a comprehensive interface for template management, deployment control, evaluation testing, and governance.

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and builds
- **TanStack Query** for efficient data fetching and caching
- **React Router v6** for declarative routing
- **Zustand** for lightweight state management
- **Radix UI** for accessible, headless UI components
- **Tailwind CSS** for utility-first styling
- **Recharts** for data visualization
- **React Hook Form** with Zod for form validation

### Key Features Implemented

#### 1. **Template Management**
- Comprehensive template listing with search and filtering
- Status badges (Active, Draft, Deprecated)
- Version tracking and management
- Tag-based organization
- Quick actions (Edit, Duplicate, Test, Analytics)

#### 2. **Dashboard & Analytics**
- Real-time platform statistics
- Usage metrics visualization
- Performance monitoring charts
- Recent activity tracking
- Key performance indicators

#### 3. **Enterprise-Grade UI**
- Responsive design for all screen sizes
- Dark mode support with CSS variables
- Accessible components (WCAG 2.1 AA compliant)
- Consistent design system
- Smooth animations and transitions

#### 4. **Navigation & Layout**
- Collapsible sidebar with navigation
- Context-aware header with search
- Breadcrumb navigation
- User menu and notifications
- Mobile-responsive design

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run unit tests
- `npm run test:ui` - Run tests with UI
- `npm run e2e` - Run end-to-end tests

## 📁 Project Structure

```
web/
├── src/
│   ├── components/
│   │   ├── ui/                    # Base UI components (Button, Input, Card, etc.)
│   │   ├── layout/                # Layout components (Sidebar, Header)
│   │   ├── auth/                  # Authentication components
│   │   └── charts/                # Chart and visualization components
│   ├── pages/                     # Page components
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   ├── Templates.tsx          # Template listing
│   │   ├── TemplateEditor.tsx      # Template creation/editing
│   │   ├── Deployments.tsx        # Deployment management
│   │   ├── Evaluations.tsx        # Testing interface
│   │   ├── Governance.tsx         # Access control
│   │   └── Settings.tsx           # Platform settings
│   ├── hooks/
│   │   └── api.ts                 # React Query hooks for API calls
│   ├── lib/
│   │   └── utils.ts              # Utility functions
│   ├── types/
│   │   └── api.ts                # TypeScript type definitions
│   └── main.tsx                  # Application entry point
├── public/                       # Static assets
├── tests/                        # Test files
└── docs/                         # Documentation
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8000
VITE_APP_TITLE=PromptOps
VITE_APP_VERSION=1.0.0
```

### API Integration

The application integrates with the backend API through:
- Custom React Query hooks in `src/hooks/api.ts`
- TypeScript interfaces for all API responses
- Automatic error handling and retry logic
- Loading states and caching

### Theme Customization

The design system uses CSS custom properties for easy theming:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... more variables */
}
```

## 🎨 Design System

### Components

The UI is built on a foundation of accessible, reusable components:

- **Base Components**: Button, Input, Card, Badge
- **Layout Components**: Sidebar, Header, Navigation
- **Form Components**: Enhanced with React Hook Form and Zod validation
- **Data Visualization**: Charts using Recharts
- **Feedback Components**: Toast notifications, loading states

### Color Palette

- **Primary**: Blue gradient for primary actions
- **Secondary**: Neutral grays for secondary elements
- **Status Colors**: Green (success), Yellow (warning), Red (error)
- **Dark Mode**: Full dark theme support

### Typography

- **Headings**: Inter, bold weights for hierarchy
- **Body**: Inter for readability
- **Code**: JetBrains Mono for technical content
- **Responsive**: Proper scaling across devices

## 🚀 Features in Detail

### Template Management

The template interface provides:
- **Search & Filter**: Real-time search with status and tag filtering
- **Version Control**: Track changes and manage versions
- **Metadata**: Rich descriptions, tags, and ownership
- **Quick Actions**: Edit, test, duplicate, and analyze templates
- **Status Management**: Active, draft, and deprecated states

### Dashboard Analytics

The dashboard includes:
- **Key Metrics**: Total templates, deployments, requests, evaluations
- **Usage Charts**: Request volume over time
- **Performance Metrics**: Latency and cost trends
- **Recent Activity**: Timeline of platform changes
- **Real-time Updates**: Live data refresh

### Navigation System

Enterprise-grade navigation features:
- **Collapsible Sidebar**: Space-efficient navigation
- **Contextual Header**: Search, notifications, user menu
- **Breadcrumb Trails**: Clear navigation path
- **Mobile Responsive**: Touch-friendly interface
- **Keyboard Navigation**: Full keyboard accessibility

## 🔒 Security & Accessibility

### Security Features
- JWT token-based authentication
- Role-based access control (RBAC)
- Input validation and sanitization
- XSS and CSRF protection
- Secure API communication

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader support
- Keyboard navigation
- ARIA labels and roles
- Focus management
- Color contrast compliance

## 🧪 Testing

### Unit Testing
- Vitest for fast unit tests
- React Testing Library for component tests
- Mock service worker for API mocking
- Coverage reporting

### End-to-End Testing
- Playwright for cross-browser E2E tests
- Visual regression testing
- Performance testing
- Accessibility testing

## 📦 Deployment

### Build Process
```bash
npm run build
```

### Production Optimization
- Tree shaking and code splitting
- Lazy loading for routes
- Image optimization
- Bundle analysis
- Service worker for offline support

### Environment Configuration
- Development, staging, production configs
- Environment-specific builds
- API endpoint management
- Feature flagging

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting and type checking
5. Submit a pull request

### Code Standards
- ESLint for code quality
- Prettier for formatting
- TypeScript strict mode
- Conventional commits
- PR templates

## 📈 Roadmap

### Phase 1: Foundation ✅
- Basic UI components and layout
- Template management interface
- Dashboard with basic analytics
- API integration framework

### Phase 2: Advanced Features
- Monaco Editor integration for template editing
- Advanced deployment controls
- Evaluation testing interface
- Governance and access controls

### Phase 3: Enterprise Features
- Multi-tenancy support
- Advanced analytics and reporting
- Integration marketplace
- Workflow automation

### Phase 4: Scale & Optimization
- Performance optimizations
- Advanced caching strategies
- Global deployment
- Enterprise security features

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Component Library](./docs/components.md)
- [Deployment Guide](./docs/deployment.md)
- [Security Guide](./docs/security.md)
- [Accessibility Guide](./docs/accessibility.md)

## 🤝 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Join our community forums
- Contact the enterprise support team

---

Built with ❤️ for enterprise prompt operations at scale.