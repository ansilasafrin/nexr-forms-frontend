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
      api.getEventById(id)
        .then(setEvent)
        .catch(() => setError("Event not found"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (answers: Record<string, any>) => {
    if (!event) return;
    await api.submitRegistration(event.id, answers);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-sm">LOADING_EVENT_DATA...</div>;
  if (!event) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-sm">EVENT_NOT_FOUND</div>;

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