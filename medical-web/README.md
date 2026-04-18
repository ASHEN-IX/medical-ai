# medical-web - Frontend Application

> Next.js frontend for MedAI Nexus healthcare platform

## 📋 Overview

This is the **user-facing web application** for MedAI Nexus. It provides:

- ✅ User authentication & registration
- ✅ Medical report upload interface
- ✅ Real-time analysis progress tracking
- ✅ Results visualization dashboard
- ✅ User profile management

## 🏗️ Architecture Rules

### ✅ RESPONSIBILITIES
- React UI components
- Form validation (client-side)
- Routing & navigation
- State management (React Query + Context)
- API communication
- Local caching

### ❌ DO NOT INCLUDE
- ❌ Backend logic
- ❌ AI model code
- ❌ Database queries
- ❌ Authentication implementation (use backend JWT)
- ❌ File storage management

## 📁 Project Structure

```
medical-web/
├── public/                 # Static assets (images, icons, etc)
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Home page
│   │   ├── dashboard/     # Dashboard routes
│   │   ├── reports/       # Reports routes
│   │   ├── analysis/      # Analysis results routes
│   │   └── auth/          # Authentication routes
│   │
│   ├── components/        # Reusable React components
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   ├── ReportUpload.tsx
│   │   ├── AnalysisProgress.tsx
│   │   ├── ResultsCard.tsx
│   │   └── common/        # Shared UI components
│   │
│   ├── lib/
│   │   ├── api.ts         # API client wrapper
│   │   ├── types.ts       # TypeScript interfaces
│   │   ├── hooks.ts       # Custom React hooks
│   │   └── utils.ts       # Utility functions
│   │
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts     # Authentication hook
│   │   ├── useReports.ts  # Reports data hook
│   │   └── useAnalysis.ts # Analysis hook
│   │
│   ├── styles/            # Global styles
│   │   └── globals.css
│   │
│   └── __tests__/         # Component tests
│       └── components/
│
├── .env.local            # Local environment (gitignored)
├── .env.example          # Example environment
├── tailwind.config.ts    # Tailwind CSS config
├── tsconfig.json         # TypeScript config
├── next.config.js        # Next.js config
├── package.json
├── Dockerfile.frontend   # Docker image
└── README.md            # This file
```

## 🚀 Development Setup

### Prerequisites
- Node.js 20+
- pnpm

### Local Development
```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Start dev server
pnpm dev

# Open http://localhost:3000
```

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=MedAI Nexus
```

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0",
    "@tanstack/react-query": "^5.0.0",
    "zod": "^3.22.0",
    "tailwindcss": "^3.3.0"
  }
}
```

## 🔧 Common Development Tasks

### Creating a New Page
```typescript
// src/app/new-page/page.tsx
export default function NewPage() {
  return <div>New Page Content</div>;
}
```

### Creating a New Component
```typescript
// src/components/MyComponent.tsx
import { FC } from 'react';

interface Props {
  title: string;
  onClick: () => void;
}

export const MyComponent: FC<Props> = ({ title, onClick }) => {
  return <button onClick={onClick}>{title}</button>;
};
```

### Using API Client
```typescript
// API call with authentication
import apiClient from '@/lib/api';

async function fetchReports() {
  try {
    const response = await apiClient.get('/reports');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch reports', error);
  }
}
```

### Using React Query
```typescript
// Hook for data fetching
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const res = await apiClient.get('/reports');
      return res.data;
    },
  });
}

// Component usage
export function ReportList() {
  const { data, isLoading } = useReports();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <ul>
      {data?.map((report) => (
        <li key={report.id}>{report.fileName}</li>
      ))}
    </ul>
  );
}
```

### Form Handling with zod
```typescript
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password too short'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = loginSchema.parse(formData);
      // Submit to backend
      await apiClient.post('/auth/login', validated);
    } catch (error) {
      console.error('Validation failed', error);
    }
  };

  // Render form...
}
```

## 🎨 Styling with TailwindCSS

All styling uses TailwindCSS utility classes:

```tsx
// Example component
export function Card() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Card Title
      </h2>
      <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Click Me
      </button>
    </div>
  );
}
```

## 📚 API Communication

All API calls go through the centralized axios client:

```typescript
// lib/api.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  timeout: 10000,
});

// Auto-attach JWT token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## ✅ Testing

### Running Tests
```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov
```

### Example Test
```typescript
// __tests__/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders with title', () => {
    render(<MyComponent title="Test" onClick={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## 🔒 Authentication Flow

1. User registers/logs in via `/auth/login` page
2. Backend returns `accessToken` & `refreshToken`
3. Frontend stores tokens in localStorage (httpOnly cookie recommended)
4. Every API request includes `Authorization: Bearer {token}` header
5. If token expires (401), redirect to login page

```typescript
// lib/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState(null);
  
  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });
    
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    
    setUser(response.data.user);
  };
  
  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };
  
  return { user, login, logout };
}
```

## 🚀 Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Analyze bundle size
pnpm analyze
```

## 🐛 Troubleshooting

### Port 3000 already in use
```bash
pnpm dev -- -p 3001
```

### TypeScript errors
```bash
# Check configuration
cat tsconfig.json

# Add missing types
pnpm add -D @types/package-name
```

### API calls failing
- Verify backend is running: `curl http://localhost:4000/health`
- Check API URL in `.env.local`
- Check network tab in DevTools

## 📝 Code Style

- **Language:** TypeScript (no JavaScript)
- **Component Format:** Functional components with hooks
- **Styling:** Tailwind CSS utility classes
- **Naming:** PascalCase for components, camelCase for files/functions
- **Imports:** Use `@/` path alias for src files

## 🔄 Component Patterns

### Data Fetching Pattern
```typescript
export function DataComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorBoundary error={error} />;
  
  return <div>{/* render data */}</div>;
}
```

### Form Pattern
```typescript
export function FormComponent() {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const validated = schema.parse(formData);
      await submitForm(validated);
    } catch (error) {
      setErrors(formatErrors(error));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Query](https://tanstack.com/query/latest)
- [zod Validation](https://zod.dev)

---

**Part of MedAI Nexus Platform**  
See [../ARCHITECTURE.md](../ARCHITECTURE.md) for full system design.
