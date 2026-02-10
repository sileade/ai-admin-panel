import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Articles from "./pages/Articles";
import Editor from "./pages/Editor";
import AiGenerate from "./pages/AiGenerate";
import AiEdit from "./pages/AiEdit";
import Images from "./pages/Images";
import Assistant from "./pages/Assistant";
import SettingsPage from "./pages/Settings";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/articles" component={Articles} />
        <Route path="/editor" component={Editor} />
        <Route path="/editor/:filename" component={Editor} />
        <Route path="/ai-generate" component={AiGenerate} />
        <Route path="/ai-edit" component={AiEdit} />
        <Route path="/ai-edit/:filename" component={AiEdit} />
        <Route path="/images" component={Images} />
        <Route path="/assistant" component={Assistant} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
