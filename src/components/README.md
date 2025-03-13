# Antara Components

## Shared Components

### AdminSidebar

The `AdminSidebar` component provides a standardized sidebar for all admin pages in the Antara application.

#### Usage

```tsx
import AdminSidebar from '../components/AdminSidebar';
import { useLocation } from 'react-router-dom';

const YourAdminPage: React.FC = () => {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar 
        isSidebarCollapsed={isSidebarCollapsed} 
        setIsSidebarCollapsed={setIsSidebarCollapsed} 
        currentPath={location.pathname}
      />
      
      {/* Rest of your page content */}
    </div>
  );
};
```

#### Props

- `isSidebarCollapsed`: Boolean state to track if sidebar is collapsed
- `setIsSidebarCollapsed`: Function to update the collapsed state
- `currentPath`: Current route path to highlight the active menu item

#### Features

- Consistent navigation across all admin pages
- Collapsible sidebar with smooth transitions
- Automatic highlighting of the current page
- Responsive design that works on all screen sizes

#### Admin Routes

The component includes links to all admin routes:

1. Dashboard (`/dashboard`)
2. Admin Panel (`/admin`)
3. User Management (`/admin/users`)
4. Admin Settings (`/admin/settings`)
5. Admin Logs (`/admin/logs`)
6. Subscription (`/subscription`)

To modify the available routes, edit the `adminRoutes` array in the `AdminSidebar.tsx` file.
