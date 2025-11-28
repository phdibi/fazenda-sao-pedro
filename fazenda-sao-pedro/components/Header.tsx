import { Link, useLocation } from 'react-router-dom';
import { Home, MapPin, Calendar, CheckSquare, FileText, Upload, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

const Header = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <header 
      className="sticky top-0 z-40 w-full border-b shadow-sm"
      style={{ backgroundColor: '#CC9966' }}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <img 
            src="/logo.png" 
            alt="São Pedro IA" 
            className="h-12 cow-logo"
            style={{ filter: 'brightness(0) invert(1)' }} // Logo branco para contrastar
          />
        </Link>

        {/* Navegação Desktop */}
        <nav className="hidden md:flex items-center space-x-1">
          <Link to="/">
            <Button
              variant={isActive('/') ? 'secondary' : 'ghost'}
              className="text-white hover:text-white hover:bg-[#B88855]"
            >
              <Home className="mr-2 h-4 w-4" />
              Painel
            </Button>
          </Link>
          <Link to="/manejo">
            <Button
              variant={isActive('/manejo') ? 'secondary' : 'ghost'}
              className="text-white hover:text-white hover:bg-[#B88855]"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Manejo
            </Button>
          </Link>
          <Link to="/agenda">
            <Button
              variant={isActive('/agenda') ? 'secondary' : 'ghost'}
              className="text-white hover:text-white hover:bg-[#B88855]"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Agenda
            </Button>
          </Link>
          <Link to="/tarefas">
            <Button
              variant={isActive('/tarefas') ? 'secondary' : 'ghost'}
              className="text-white hover:text-white hover:bg-[#B88855]"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Tarefas
            </Button>
          </Link>
          <Link to="/relatorios">
            <Button
              variant={isActive('/relatorios') ? 'secondary' : 'ghost'}
              className="text-white hover:text-white hover:bg-[#B88855]"
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatórios
            </Button>
          </Link>
        </nav>

        {/* Navegação Mobile - Apenas Relatórios */}
        <div className="md:hidden">
          <Link to="/relatorios">
            <Button
              variant={isActive('/relatorios') ? 'secondary' : 'ghost'}
              size="sm"
              className="text-white hover:text-white hover:bg-[#B88855]"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Ações do usuário */}
        <div className="flex items-center space-x-2">
          {/* Botão Sync - Desktop e Mobile */}
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white hover:text-white hover:bg-[#B88855]"
          >
            <Upload className="h-4 w-4" />
          </Button>

          {/* Botão Adicionar Animal - Apenas Desktop */}
          <Link to="/manejo" className="hidden md:block">
            <Button 
              className="text-white"
              style={{ backgroundColor: '#8B4513' }}
            >
              Adicionar Animal
            </Button>
          </Link>

          {/* Menu do usuário */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-white text-[#CC9966]">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Minha Conta</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
