import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, MapPin, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as api from '../../../services/dataService';
import { EventData, FieldType } from '../../../types';
import { Button, Input, Select, Card, Badge } from '../../../components/UI';
import { EventRenderer } from '../../../components/EventRenderer';

export const PublicEvent = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      console.log('PublicEvent: Detected Event ID from URL:', id);
      setLoading(true);
      api.getEventById(id)
        .then(data => {
          if (!data) {
            console.error('PublicEvent: API returned null for ID:', id);
            setError("This event does not exist");
          } else {
            console.log('PublicEvent: Successfully loaded event:', data.title);
            setEvent(data);
          }
        })
        .catch(err => {
          console.error('PublicEvent: API fetch error:', err);
          setError("Failed to load event. Please try again later.");
        })
        .finally(() => setLoading(false));
    } else {
      console.warn('PublicEvent: No ID found in URL params');
    }
  }, [id]);

  const handleSubmit = async (answers: Record<string, any>) => {
    if (!event) return;
    await api.submitRegistration(event.id, answers);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-500 font-mono text-sm gap-4">
      <Loader2 className="w-6 h-6 animate-spin text-white" />
      <span>LOADING_EVENT_DATA...</span>
    </div>
  );

  if (error || !event) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-500 font-mono text-sm gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
        <AlertCircle className="w-8 h-8 text-zinc-700" />
      </div>
      <div className="space-y-2">
        <h2 className="text-white text-lg font-medium">{error || "EVENT_NOT_FOUND"}</h2>
        <p className="text-zinc-500 max-w-xs mx-auto">Please check the link and try again, or contact the event organizer.</p>
      </div>
      <Button variant="secondary" onClick={() => window.location.href = '/'}>Go back home</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-zinc-200 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-white">{event.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {event.location}
              </div>
            )}
            {event.is_paid && (
              <div className="flex items-center gap-1.5 text-yellow-500/80">
                <AlertCircle className="w-4 h-4" />
                Admin verification required for this event
              </div>
            )}
          </div>
        </div>
        <EventRenderer event={event} onSubmit={handleSubmit} />

        <footer className="mt-12 pt-8 border-t border-white/5 text-center text-zinc-600 text-xs">
          <p>Powered by EventFlow • Secure Registration Platform</p>
        </footer>
      </div>
    </div>
  );
};