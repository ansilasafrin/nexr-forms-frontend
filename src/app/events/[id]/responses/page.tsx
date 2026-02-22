import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Check, X } from 'lucide-react';
import * as api from '../../../../services/dataService';
import useSWR from 'swr';
import { EventData, Registration } from '../../../../types';
import { Button, Card } from '../../../../components/UI';

export const EventResponses = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: event, isLoading: eventLoading } = useSWR(
        id ? [`/events`, id] : null,
        () => api.getEventById(id!)
    );

    const { data: registrations, isLoading: regsLoading, mutate: mutateRegs } = useSWR(
        id ? [`/events/registrations`, id] : null,
        () => api.getEventRegistrations(id!)
    );

    const loading = eventLoading || regsLoading;

    const getImageUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000';
        return `${baseUrl}/uploads/${path}`;
    };

    const renderAnswer = (val: any, fieldType: string) => {
        if (!val || val === '') {
            if (fieldType === 'FILE_UPLOAD') return <span className="text-zinc-500 italic">No file uploaded</span>;
            return '-';
        }
        if (Array.isArray(val)) return val.join(', ');
        const strVal = String(val);
        if (strVal.match(/\.(jpeg|jpg|png|gif|webp)$/i)) {
            return (
                <a href={getImageUrl(strVal)} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded overflow-hidden border border-white/20 hover:border-white/50 transition-colors">
                    <img src={getImageUrl(strVal)} alt="Answer" className="w-full h-full object-cover" />
                </a>
            );
        }
        if (strVal.match(/\.pdf$/i)) {
            return (
                <a href={getImageUrl(strVal)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-400 hover:text-blue-300 underline">
                    <Download className="w-4 h-4 mr-1" /> View PDF
                </a>
            );
        }
        return strVal;
    };

    const handleExport = () => {
        if (!event || !registrations || registrations.length === 0) return;

        // Simple CSV Export Logic
        const headers = ['Submitted At', ...event.fields.map(f => f.label)];
        const rows = registrations.map(reg => {
            const row = [new Date(reg.submittedAt).toLocaleString()];
            event.fields.forEach(field => {
                let val = reg.answers[field.id];
                if (Array.isArray(val)) val = val.join('; ');
                row.push(`"${val || ''}"`);
            });
            return row.join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${event.title} _registrations.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const filteredRegistrations = registrations?.filter(reg => {
        const allValues = Object.values(reg.answers).join(' ').toLowerCase();
        return allValues.includes(searchTerm.toLowerCase());
    }) || [];

    const handleApprove = async (regId: string) => {
        if (!event) return;
        try {
            await api.approveRegistration(event.id, regId);
            mutateRegs(); // Revalidate SWR cache
        } catch (e) {
            alert('Failed to approve');
        }
    };

    const handleReject = async (regId: string) => {
        if (!event) return;
        if (!confirm('Are you sure you want to reject this payment?')) return;
        try {
            await api.rejectRegistration(event.id, regId);
            mutateRegs(); // Revalidate SWR cache
        } catch (e) {
            alert('Failed to reject');
        }
    };

    if (!event) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="min-h-screen">
            <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center">
                        <Button variant="ghost" onClick={() => navigate('/')} className="mr-4 -ml-2">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-wide">{event.title}</h1>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest mt-0.5">Responses</p>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={handleExport} icon={Download} disabled={registrations.length === 0}>
                        Export CSV
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-white">{registrations.length} Responses</h2>
                    <div className="relative w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-zinc-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            className="pl-9 pr-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-white/20 focus:border-white/20 block w-full text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <Card className="overflow-hidden border-white/5">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                        Submitted At
                                    </th>
                                    {event.fields.map(field => (
                                        <th key={field.id} className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                            {field.label}
                                        </th>
                                    ))}
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 bg-transparent">
                                {filteredRegistrations.map(reg => (
                                    <tr key={reg.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {reg.paymentStatus === 'paid' && <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/20">Paid</span>}
                                            {reg.paymentStatus === 'failed' && <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20">Failed</span>}
                                            {(!reg.paymentStatus || reg.paymentStatus === 'pending') && <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium border border-yellow-500/20">Pending</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                                            {new Date(reg.submittedAt).toLocaleString()}
                                        </td>
                                        {event.fields.map(field => (
                                            <td key={field.id} className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                {renderAnswer(reg.answers[field.id], field.type)}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="flex justify-end gap-2">
                                                {reg.paymentStatus !== 'paid' && (
                                                    <button
                                                        onClick={() => handleApprove(reg.id)}
                                                        className="p-1 px-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md transition-colors flex items-center gap-1 text-xs font-medium border border-green-500/20"
                                                        title="Approve Payment"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Approve
                                                    </button>
                                                )}
                                                {reg.paymentStatus !== 'failed' && reg.paymentStatus !== 'paid' && (
                                                    <button
                                                        onClick={() => handleReject(reg.id)}
                                                        className="p-1 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors flex items-center gap-1 text-xs font-medium border border-red-500/20"
                                                        title="Reject Payment"
                                                    >
                                                        <X className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRegistrations.length === 0 && (
                                    <tr>
                                        <td colSpan={event.fields.length + 3} className="px-6 py-20 text-center text-sm text-zinc-600">
                                            No registrations found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </main>
        </div>
    );
};