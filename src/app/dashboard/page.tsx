import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Users, Layout, LogOut, Loader2, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import * as api from '../../services/dataService';
import useSWR from 'swr';
import { EventData, DashboardStats } from '../../types';
import { Card, Button, Badge } from '../../components/UI';
const StatCard = ({ title, value, icon: Icon }: any) => (
  <Card className="p-6 relative overflow-hidden group hover:bg-white/5 transition-colors">
    <div className="relative z-10 flex flex-col h-full justify-between">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-widest font-semibold text-zinc-500">{title}</p>
        <Icon className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
      </div>
      <p className="text-4xl font-light text-white">{value}</p>
    </div>
  </Card>
);

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: events, error: eventsError, isLoading: eventsLoading } = useSWR(
    user ? ['/events', user.id] : null,
    () => api.getEvents(user!.id)
  );

  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR(
    user ? ['/stats', user.id] : null,
    () => api.getDashboardStats(user!.id)
  );

  const loading = eventsLoading || statsLoading;

  const handleCreateEvent = async () => {
    if (!user) return;
    try {
      const newEvent = await api.createEvent(user.id, { title: 'Untitled Event' });
      navigate(`/events/${newEvent.id}/edit`);
    } catch (err: any) {
      console.error("Dashboard: Failed to create event", err);
      alert(`Failed to create event: ${err.message || 'Unknown error'}`);
    }
  };

  const handleCopyLink = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/events/${eventId}`;
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard!");
  };

  const handleShareLink = async (e: React.MouseEvent, eventId: string, title: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/events/${eventId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        // Optional: could show a success toast
      } catch (err) {
        // If share fails, fallback to copy
        navigator.clipboard.writeText(url);
        alert("Link copied to clipboard (share failed).");
      }
    } else {
      // Fallback for browsers without native share
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-black"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans pb-12">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center rounded-lg">
                <Layout className="w-5 h-5 text-black" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">EventFlow</span>
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-xs font-mono text-zinc-500 hidden sm:block">{user?.email}</span>
              <Button variant="ghost" onClick={logout} icon={LogOut}>Logout</Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-light text-white mb-2">Overview</h1>
            <p className="text-zinc-500">Manage your events and registrations</p>
          </div>
          <Button onClick={handleCreateEvent} icon={Plus} className="shadow-[0_0_20px_rgba(255,255,255,0.1)]">Create Event</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <StatCard title="Total Events" value={stats?.totalEvents || 0} icon={Calendar} />
          <StatCard title="Total Registrations" value={stats?.totalRegistrations || 0} icon={Users} />
          <StatCard title="Upcoming" value={stats?.upcomingEvents || 0} icon={Calendar} />
        </div>

        {/* Event List */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Your Events</h2>

        {(!events || events.length === 0) ? (
          <Card className="text-center py-24 border-dashed border-2 border-zinc-800 bg-transparent hover:border-zinc-700 transition-colors cursor-pointer" onClick={handleCreateEvent}>
            <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
              <Plus className="h-6 w-6 text-zinc-500" />
            </div>
            <h3 className="text-xl font-medium text-white">Create your first event</h3>
            <p className="mt-2 text-zinc-500 max-w-sm mx-auto">Start collecting registrations in minutes. No credit card required.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {events.map((event: EventData) => (
              <Card key={event.id} className="group relative overflow-hidden transition-all duration-300 hover:bg-zinc-900/60">
                <div className="px-6 py-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-medium text-white truncate group-hover:text-white transition-colors">{event.title}</h3>
                        <Badge status={event.status} />
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-1">{event.description || "No description provided."}</p>
                    </div>
                    <Button variant="secondary" className="h-8 w-8 p-0 rounded-full" onClick={(e: any) => handleCopyLink(e, event.id)} title="Copy Public Link">
                      <LinkIcon className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-white/5 gap-4 sm:gap-0">
                    <div className="flex items-center gap-6 text-xs text-zinc-400 font-mono w-full sm:w-auto justify-between sm:justify-start">
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-2" />
                        {event.registrationCount || 0}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-2" />
                        {new Date(event.startDateTime).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex w-full sm:w-auto space-x-2">
                      <Button variant="ghost" onClick={() => window.open(`/events/${event.id}`, '_blank')} className="flex-1 sm:flex-none text-xs hover:bg-white text-zinc-400 hover:text-black justify-center">
                        <ExternalLink className="w-3 h-3 mr-1" /> View Public
                      </Button>
                      <Button variant="secondary" onClick={() => navigate(`/events/${event.id}/responses`)} className="flex-1 sm:flex-none text-xs px-3 py-1 justify-center">
                        Responses
                      </Button>
                      <Button variant="primary" onClick={() => navigate(`/events/${event.id}/edit`)} className="flex-1 sm:flex-none text-xs px-3 py-1 justify-center">
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};