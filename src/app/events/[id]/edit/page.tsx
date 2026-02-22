import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Plus, Trash2, MoveUp, MoveDown, Save, Eye, Settings, FileText, AlertTriangle, ExternalLink, Image as ImageIcon, X, Layout, Smartphone, Activity, Download } from 'lucide-react';
import { useAuth } from '../../../../lib/auth';
import { validateEventDates } from '../../../../lib/validation';
import * as api from '../../../../services/dataService';
import { EventData, EventField, FieldType, EventStatus, Registration } from '../../../../types';
import { Button, Input, Select, Card, Badge } from '../../../../components/UI';
import { EventRenderer } from '../../../../components/EventRenderer';
import { QuestionTypeSelector, OptionManager, LinearScaleConfig, RatingConfig, FileUploadConfig, LogicBuilder } from '../../../../components/FormBuilder';
import { EventAnalytics } from '../../../../components/EventAnalytics';

export const EventBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);

  // Helper to resolve image URLs
  const getImageUrl = (path: string | undefined) => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://127.0.0.1:8000';
    return `${baseUrl}${path}`;
  };
  const [activeTab, setActiveTab] = useState<'settings' | 'form' | 'preview' | 'analytics'>('settings');
  const [saving, setSaving] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'analytics' && id) {
      setAnalyticsLoading(true);
      api.getEventRegistrations(id)
        .then(regs => setRegistrations(regs))
        .catch(err => console.error(err))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab, id]);

  useEffect(() => {
    if (id) {
      api.getOrganizerEvent(id).then(data => setEvent(data));
    }
  }, [id]);

  const prepareForSave = (currentEvent: EventData) => {
    // Sanitize fields: convert temp string IDs to null for backend
    const fields = currentEvent.fields.map((f, index) => {
      const isTempId = isNaN(Number(f.id));
      return {
        ...f,
        id: isTempId ? null : f.id,
        order: index
      } as any;
    });
    return { ...currentEvent, fields };
  };

  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const isFirstLoad = React.useRef(true);

  useEffect(() => {
    if (!event?.id) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const payload = prepareForSave(event);
        // Silent update
        await api.updateEvent(event.id, payload);
        setAutoSaveStatus('saved');
      } catch (err) {
        console.error("Auto-save failed", err);
        setAutoSaveStatus('error');
      }
    }, 2000); // Debounce 2s

    return () => clearTimeout(timer);
  }, [event]);

  const handleSave = async () => {
    if (!event) return;

    // Validate dates
    const dateError = validateEventDates(event.startDateTime, event.endDateTime);
    if (dateError) {
      alert(dateError);
      return;
    }

    setSaving(true);
    try {
      const payload = prepareForSave(event);
      const updated = await api.updateEvent(event.id, payload);
      setEvent(updated);
    } catch (e) {
      console.error("Save failed", e);
      alert("Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!event) return;

    // Validate dates before publishing
    const dateError = validateEventDates(event.startDateTime, event.endDateTime);
    if (dateError) {
      alert(dateError);
      return;
    }

    setSaving(true);
    try {
      const payload = prepareForSave(event);
      await api.updateEvent(event.id, {
        ...payload,
        status: event.status === EventStatus.PUBLISHED ? EventStatus.CLOSED : EventStatus.PUBLISHED
      });
      const updated = await api.getOrganizerEvent(event.id);
      setEvent(updated);
    } catch (e) {
      console.error("Publish failed", e);
      alert("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !window.confirm("Are you sure? This cannot be undone.")) return;
    await api.deleteEvent(event.id);
    navigate('/');
  }

  // --- FORM BUILDER HELPERS ---

  const addField = () => {
    if (!event) return;
    const newField: EventField = {
      id: Math.random().toString(36).substr(2, 9),
      eventId: event.id,
      label: 'New Question',
      type: FieldType.SHORT_TEXT,
      required: false,
      order: event.fields.length,
      options: ['Option 1', 'Option 2'],
      description: '',
      minValue: 1,
      maxValue: 5,
      fileTypes: ['pdf', 'jpg', 'png'],
      maxFileSize: 10485760, // 10MB
    };
    setEvent({ ...event, fields: [...event.fields, newField] });
  };

  const updateField = (index: number, changes: Partial<EventField>) => {
    if (!event) return;
    const newFields = [...event.fields];
    newFields[index] = { ...newFields[index], ...changes };
    setEvent({ ...event, fields: newFields });
  };

  const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert("Image size should be less than 5MB");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('eventflow_token');
      const baseUrl = api.API_URL;
      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      updateField(index, { imageUrl: data.url });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    }
  };

  const removeField = (index: number) => {
    if (!event) return;
    const newFields = event.fields.filter((_, i) => i !== index);
    setEvent({ ...event, fields: newFields });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (!event) return;
    const newFields = [...event.fields];
    if (direction === 'up' && index > 0) {
      [newFields[index], newFields[index - 1]] = [newFields[index - 1], newFields[index]];
    } else if (direction === 'down' && index < newFields.length - 1) {
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    }
    setEvent({ ...event, fields: newFields });
  };

  if (!event) return <div className="p-8 text-white">Loading...</div>;

  const publicUrl = `${window.location.origin}/forms/${event.id}/view`;

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Top Bar */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mr-4 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">{event.title}</h1>
              <div className="flex items-center space-x-3 text-xs mt-0.5">
                <Badge status={event.status} />
                {event.status === EventStatus.PUBLISHED && (
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white transition-colors flex items-center">
                    View Live <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
                <div className="pl-3 border-l border-zinc-800 ml-3 flex items-center">
                  {autoSaveStatus === 'saving' && <span className="text-zinc-500 flex items-center text-[10px] uppercase tracking-wider font-semibold"><div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>Saving</span>}
                  {autoSaveStatus === 'saved' && <span className="text-zinc-600 flex items-center text-[10px] uppercase tracking-wider font-semibold"><div className="w-1.5 h-1.5 bg-green-500/50 rounded-full mr-2"></div>Saved</span>}
                  {autoSaveStatus === 'error' && <span className="text-red-500 flex items-center text-[10px] uppercase tracking-wider font-semibold"><div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>Error</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button variant="secondary" onClick={() => setActiveTab('preview')} icon={Eye} className="hidden xs:flex">Preview</Button>
            <Button variant="secondary" onClick={handleSave} disabled={saving} icon={Save} className="flex-1 sm:flex-none">
              {saving ? '...' : 'Save'}
            </Button>
            <Button
              variant={event.status === EventStatus.PUBLISHED ? 'danger' : 'primary'}
              onClick={handlePublish}
              className="flex-1 sm:flex-none"
            >
              {event.status === EventStatus.PUBLISHED ? (window.innerWidth < 640 ? 'Close' : 'Close Event') : 'Publish'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-zinc-900/80 p-1 rounded-xl border border-white/10 grid grid-cols-2 sm:inline-flex w-full sm:w-auto gap-1 sm:gap-0">
            <button
              className={`flex items-center justify-center px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'} `}
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </button>
            <button
              className={`flex items-center justify-center px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'form' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'} `}
              onClick={() => setActiveTab('form')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Questions
            </button>
            <button
              className={`flex items-center justify-center px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'} `}
              onClick={() => setActiveTab('analytics')}
            >
              <Activity className="w-4 h-4 mr-2" />
              Analytics
            </button>
            <button
              className={`flex items-center justify-center px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'preview' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'} `}
              onClick={() => setActiveTab('preview')}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Preview
            </button>
          </div>
        </div>

        {activeTab === 'preview' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <p className="text-zinc-500 text-sm">This is how your form looks to attendees</p>
            </div>
            <EventRenderer event={event} previewMode={true} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-medium text-white mb-6">Basic Information</h3>
                <Input
                  label="Event Title"
                  value={event.title}
                  onChange={(e: any) => setEvent({ ...event, title: e.target.value })}
                />
                <div className="mb-4">
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
                  <textarea
                    rows={4}
                    className="block w-full px-3 py-2.5 bg-zinc-900/50 border border-white/10 rounded-lg shadow-sm focus:ring-2 focus:ring-white/20 focus:border-white/30 text-zinc-100 sm:text-sm transition-colors"
                    value={event.description || ''}
                    onChange={(e) => setEvent({ ...event, description: e.target.value })}
                  />
                </div>
                <Input
                  label="Location"
                  value={event.location || ''}
                  onChange={(e: any) => setEvent({ ...event, location: e.target.value })}
                />
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-medium text-white mb-6">Form Settings</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <h4 className="text-white font-medium">Paid Event</h4>
                      <p className="text-sm text-zinc-400">Require admin verification for registrations. Free events are auto-approved.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        value=""
                        className="sr-only peer"
                        checked={event.isPaid || false}
                        onChange={(e) => setEvent({ ...event, isPaid: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <h4 className="text-white font-medium">Limit to 1 Response</h4>
                      <p className="text-sm text-zinc-400">Prevent users from submitting multiple times (requires email)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        value=""
                        className="sr-only peer"
                        checked={event.limitOneResponse || false}
                        onChange={(e) => setEvent({ ...event, limitOneResponse: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-300">WhatsApp Group Link</label>
                    <div className="relative">
                      <Smartphone className="absolute top-3 left-3 w-5 h-5 text-zinc-500" />
                      <input
                        type="url"
                        placeholder="https://chat.whatsapp.com/..."
                        className="block w-full pl-10 pr-3 py-2.5 bg-zinc-900/50 border border-white/10 rounded-lg shadow-sm focus:ring-2 focus:ring-white/20 focus:border-white/30 text-zinc-100 sm:text-sm transition-colors"
                        value={event.whatsappLink || ''}
                        onChange={(e) => setEvent({ ...event, whatsappLink: e.target.value })}
                      />
                    </div>
                    <p className="text-xs text-zinc-500">A button to join this group will be shown after successful registration.</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-red-900/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-white">Danger Zone</h3>
                </div>
                <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                  <p className="text-sm text-red-400">Deleting this event will remove all registration data permanently.</p>
                  <Button variant="danger" onClick={handleDelete} icon={Trash2}>Delete Event</Button>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-medium text-white mb-6">Date & Time</h3>
                <Input
                  label="Start Date/Time"
                  type="datetime-local"
                  value={event.startDateTime ? event.startDateTime.substring(0, 16) : ''}
                  onChange={(e: any) => setEvent({ ...event, startDateTime: e.target.value })}
                />
                <Input
                  label="End Date/Time"
                  type="datetime-local"
                  value={event.endDateTime ? event.endDateTime.substring(0, 16) : ''}
                  onChange={(e: any) => setEvent({ ...event, endDateTime: e.target.value })}
                />
              </Card>
              <Card className="p-6">
                <h3 className="text-lg font-medium text-white mb-6">Capacity</h3>
                <Input
                  label="Max Seats (Empty = unlimited)"
                  type="number"
                  value={event.maxSeats || ''}
                  onChange={(e: any) => setEvent({ ...event, maxSeats: e.target.value ? parseInt(e.target.value) : null })}
                />
              </Card>

            </div>
          </div>
        )}

        {activeTab === 'form' && (
          <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Customize Registration Form</h2>
              <p className="text-zinc-500 mt-2">Add questions your attendees need to answer.</p>
            </div>

            {event.fields.length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-zinc-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-1">No questions yet</h3>
                <p className="text-zinc-500 max-w-sm mx-auto mb-6">Start building your form by adding questions or sections below.</p>
              </div>
            ) : (
              event.fields.map((field, idx) => {
                if (field.type === FieldType.SECTION) {
                  return (
                    <div key={field.id} className="relative group mt-8 mb-4">
                      <div className="bg-zinc-900 border-t-4 border-t-white border-x border-b border-white/10 rounded-lg p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50"></div>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-4">
                            <Input
                              placeholder="Section Title"
                              value={field.label}
                              onChange={(e: any) => updateField(idx, { label: e.target.value })}
                              className="text-2xl font-bold bg-transparent border-none px-0 focus:ring-0 placeholder-zinc-600"
                            />
                            <input
                              type="text"
                              placeholder="Section Description (optional)"
                              value={field.description || ''}
                              onChange={(e) => updateField(idx, { description: e.target.value })}
                              className="w-full bg-transparent border-none p-0 text-zinc-400 placeholder-zinc-700 focus:ring-0 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="p-2 text-zinc-600 hover:text-white transition-colors">
                              <MoveUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveField(idx, 'down')} disabled={idx === event.fields.length - 1} className="p-2 text-zinc-600 hover:text-white transition-colors">
                              <MoveDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeField(idx)} className="p-2 text-zinc-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                          <span className="text-sm text-zinc-400">After section {event.fields.filter(f => f.type === FieldType.SECTION).findIndex(s => s.id === field.id) + 1}</span>

                          <select
                            className="bg-black border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer w-64"
                            value={field.logic?.default || 'NEXT'}
                            onChange={(e) => updateField(idx, { logic: { ...(field.logic || {}), default: e.target.value } })}
                          >
                            <option value="NEXT">Continue to next section</option>
                            <option value="SUBMIT">Submit form</option>
                            {event.fields
                              .filter(f => f.type === FieldType.SECTION)
                              .map((section, sIdx) => (
                                <option key={section.id} value={section.id}>
                                  Go to section {sIdx + 1} ({section.label || 'Untitled section'})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <Card key={field.id} className="p-4 sm:p-6 bg-white/5 backdrop-blur-md border border-white/10 transition-all hover:border-white/20 hover:bg-white/[0.07] group">
                    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                      <div className="flex-1 space-y-4 w-full">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Input
                              placeholder="Question"
                              value={field.label}
                              onChange={(e: any) => updateField(idx, { label: e.target.value })}
                              className="text-lg font-medium"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="file"
                              id={`q-img-${field.id}`}
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(idx, e)}
                            />
                            <label
                              htmlFor={`q-img-${field.id}`}
                              className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors block"
                              title="Add Image"
                            >
                              <ImageIcon className="w-5 h-5" />
                            </label>
                          </div>
                        </div>

                        {field.imageUrl && (
                          <div className="relative w-full max-w-md mt-2 group/img">
                            <img
                              src={getImageUrl(field.imageUrl)}
                              alt="Question attachment"
                              className="rounded-lg border border-white/10 w-full object-cover max-h-64"
                            />
                            <button
                              onClick={() => updateField(idx, { imageUrl: undefined })}
                              className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors opacity-0 group-hover/img:opacity-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Question Type Selector */}
                        <QuestionTypeSelector
                          currentType={field.type}
                          onTypeChange={(type) => updateField(idx, { type })}
                        />

                        {/* Description/Help Text */}
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">Description (optional)</label>
                          <input
                            type="text"
                            placeholder="Add help text..."
                            value={field.description || ''}
                            onChange={(e) => updateField(idx, { description: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                          />
                        </div>

                        {/* Type-Specific Configuration */}
                        {(field.type === FieldType.DROPDOWN ||
                          field.type === FieldType.CHECKBOX ||
                          field.type === FieldType.MULTIPLE_CHOICE) && (
                            <div className="space-y-4">
                              <OptionManager
                                options={field.options || ['Option 1']}
                                onChange={(options) => updateField(idx, { options })}
                              />

                              {(field.type === FieldType.DROPDOWN || field.type === FieldType.MULTIPLE_CHOICE) && (
                                <LogicBuilder
                                  options={field.options || []}
                                  logic={field.logic}
                                  sections={event.fields
                                    .filter(f => f.type === FieldType.SECTION)
                                    .map(f => ({ id: f.id, label: f.label, order: f.order }))}
                                  onChange={(logic) => updateField(idx, { logic })}
                                />
                              )}
                            </div>
                          )}

                        {field.type === FieldType.LINEAR_SCALE && (
                          <LinearScaleConfig
                            minValue={field.minValue || 1}
                            maxValue={field.maxValue || 5}
                            onMinChange={(minValue) => updateField(idx, { minValue })}
                            onMaxChange={(maxValue) => updateField(idx, { maxValue })}
                          />
                        )}

                        {field.type === FieldType.RATING && (
                          <RatingConfig
                            maxStars={field.maxValue || 5}
                            onMaxStarsChange={(maxValue) => updateField(idx, { maxValue })}
                          />
                        )}

                        {field.type === FieldType.FILE_UPLOAD && (
                          <FileUploadConfig
                            fileTypes={field.fileTypes || ['*']}
                            maxFileSize={field.maxFileSize || 10485760}
                            onFileTypesChange={(fileTypes) => updateField(idx, { fileTypes })}
                            onMaxFileSizeChange={(maxFileSize) => updateField(idx, { maxFileSize })}
                          />
                        )}

                        {/* Required Toggle */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <label className="flex items-center text-sm text-zinc-400 hover:text-white cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="mr-2 h-4 w-4 bg-zinc-800 border-zinc-600 rounded text-white focus:ring-0 focus:ring-offset-0"
                              checked={field.required}
                              onChange={(e) => updateField(idx, { required: e.target.checked })}
                            />
                            Required field
                          </label>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-stretch w-full sm:w-auto justify-between sm:justify-start space-x-2 sm:space-x-0 sm:space-y-1 sm:pl-4 sm:border-l border-white/5 border-t sm:border-t-0 pt-4 sm:pt-0">
                        <button onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="p-2 flex-1 sm:flex-none text-zinc-600 hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-white/5 flex justify-center">
                          <MoveUp className="w-5 h-5" />
                        </button>
                        <button onClick={() => moveField(idx, 'down')} disabled={idx === event.fields.length - 1} className="p-2 flex-1 sm:flex-none text-zinc-600 hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-white/5 flex justify-center">
                          <MoveDown className="w-5 h-5" />
                        </button>
                        <button onClick={() => removeField(idx)} className="p-2 flex-1 sm:flex-none text-red-900 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 sm:mt-2 flex justify-center">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              }))}

            <div className="flex items-center gap-4">
              <Button onClick={addField} variant="secondary" className="flex-1 border-dashed border-2 border-zinc-700 py-4 text-zinc-500 hover:text-white hover:border-zinc-500 hover:bg-transparent" icon={Plus}>
                Add Question
              </Button>
              <Button
                onClick={() => {
                  const newField: EventField = {
                    id: Math.random().toString(36).substr(2, 9),
                    eventId: event.id,
                    label: 'New Section',
                    type: FieldType.SECTION,
                    required: false,
                    order: event.fields.length,
                    description: '',
                  };
                  setEvent({ ...event, fields: [...event.fields, newField] });
                }}
                variant="secondary"
                className="w-16 border-dashed border-2 border-zinc-700 py-4 text-zinc-500 hover:text-white hover:border-zinc-500 hover:bg-transparent justify-center"
                title="Add Section"
              >
                <Layout className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && event && (
          <EventAnalytics event={event} registrations={registrations} loading={analyticsLoading} />
        )}
      </div>
    </div>
  );
};