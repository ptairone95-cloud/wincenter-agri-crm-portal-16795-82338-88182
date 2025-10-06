import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, FileText, Plus, Check, X, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function Visits() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [completionDescription, setCompletionDescription] = useState('');
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [opportunityData, setOpportunityData] = useState({
    stage: 'lead' as 'lead' | 'qualified' | 'proposal' | 'closing' | 'won' | 'lost',
    probability: 0,
    gross_value: '',
    notes: '',
  });
  const [demoData, setDemoData] = useState({
    date: '',
    notes: '',
    assigned_users: [] as string[],
    products: [] as string[],
    demo_types: [] as string[],
    crop: '',
    hectares: '',
  });
  const [formData, setFormData] = useState({
    client_id: '',
    scheduled_at: '',
    objective: '',
    notes: '',
    status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled',
  });

  const { data: visits, isLoading, refetch } = useQuery({
    queryKey: ["visits", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("visits")
        .select(`
          *,
          clients (
            farm_name,
            contact_name,
            city,
            state
          )
        `)
        .eq("seller_auth_id", user.id)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
          .from("clients")
          .select("id, farm_name, contact_name")
          .or(`seller_auth_id.eq.${user.id},owner_user_id.eq.${user.id}`)
          .order("farm_name");

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, role, auth_user_id")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const upcomingVisits = visits?.filter(v => v.status === 'scheduled') || [];
  const completedVisits = visits?.filter(v => v.status === 'completed') || [];
  const cancelledVisits = visits?.filter(v => v.status === 'cancelled') || [];

  const resetForm = () => {
    setFormData({
      client_id: '',
      scheduled_at: '',
      objective: '',
      notes: '',
      status: 'scheduled',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const visitData = {
        client_id: formData.client_id,
        seller_auth_id: user?.id,
        scheduled_at: formData.scheduled_at || null,
        objective: formData.objective || null,
        notes: formData.notes || null,
        status: formData.status,
      };

      const { error } = await supabase
        .from('visits')
        .insert([visitData]);

      if (error) throw error;

      toast.success('Visita criada com sucesso!');
      setDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error('Error creating visit:', error);
      toast.error('Erro ao criar visita: ' + error.message);
    }
  };

  const handleMarkAsCompleted = (visit: any) => {
    setSelectedVisit(visit);
    setCompletionDescription('');
    setShowOpportunityForm(false);
    setShowDemoForm(false);
    setCompletionDialogOpen(true);
  };

  const handleConfirmCompletion = async () => {
    if (!selectedVisit) return;

    try {
      const updateData: any = { status: 'completed' };
      if (completionDescription.trim()) {
        updateData.notes = completionDescription;
      }

      const { error } = await supabase
        .from('visits')
        .update(updateData)
        .eq('id', selectedVisit.id);

      if (error) throw error;

      toast.success('Visita marcada como realizada!');
      setCompletionDialogOpen(false);
      setSelectedVisit(null);
      setCompletionDescription('');
      refetch();
    } catch (error: any) {
      console.error('Error updating visit status:', error);
      toast.error('Erro ao atualizar visita: ' + error.message);
    }
  };

  const handleScheduleDemonstration = async () => {
    if (!selectedVisit) return;
    
    if (!demoData.date) {
      toast.error('Selecione uma data para a demonstração');
      return;
    }

    try {
      const { error } = await supabase
        .from('demonstrations')
        .insert([{
          client_id: selectedVisit.client_id,
          date: demoData.date,
          notes: demoData.notes || null,
          assigned_users: demoData.assigned_users,
          products: demoData.products,
          demo_types: demoData.demo_types,
          crop: demoData.crop || null,
          hectares: demoData.hectares ? parseFloat(demoData.hectares) : null,
          status: 'scheduled',
        }]);

      if (error) throw error;

      toast.success('Demonstração agendada com sucesso!');
      setShowDemoForm(false);
      setDemoData({ 
        date: '', 
        notes: '', 
        assigned_users: [], 
        products: [], 
        demo_types: [], 
        crop: '', 
        hectares: '' 
      });
    } catch (error: any) {
      console.error('Error creating demonstration:', error);
      toast.error('Erro ao agendar demonstração: ' + error.message);
    }
  };

  const handleCreateOpportunity = async () => {
    if (!selectedVisit) return;

    try {
      const { error } = await supabase
        .from('opportunities')
        .insert([{
          client_id: selectedVisit.client_id,
          seller_auth_id: user?.id,
          stage: opportunityData.stage,
          probability: opportunityData.probability,
          gross_value: opportunityData.gross_value ? parseFloat(opportunityData.gross_value) : null,
          history: opportunityData.notes || null,
        }]);

      if (error) throw error;

      toast.success('Oportunidade criada com sucesso!');
      setShowOpportunityForm(false);
      setOpportunityData({ stage: 'lead', probability: 0, gross_value: '', notes: '' });
    } catch (error: any) {
      console.error('Error creating opportunity:', error);
      toast.error('Erro ao criar oportunidade: ' + error.message);
    }
  };

  const handleUpdateStatus = async (visitId: string, newStatus: 'completed' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ status: newStatus })
        .eq('id', visitId);

      if (error) throw error;

      const statusText = newStatus === 'completed' ? 'realizada' : 'cancelada';
      toast.success(`Visita marcada como ${statusText}!`);
      refetch();
    } catch (error: any) {
      console.error('Error updating visit status:', error);
      toast.error('Erro ao atualizar visita: ' + error.message);
    }
  };

  const handleViewVisit = (visit: any) => {
    setSelectedVisit(visit);
    setViewDialogOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Visitas</h1>
            <p className="text-muted-foreground">Gerencie suas visitas aos clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Visita
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Visita</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Cliente *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.farm_name} - {client.contact_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Data e Hora Agendada</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objective">Objetivo</Label>
                  <Textarea
                    id="objective"
                    value={formData.objective}
                    onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                    placeholder="Descreva o objetivo da visita..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Anotações adicionais..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'scheduled' | 'completed' | 'cancelled') => 
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Agendada</SelectItem>
                      <SelectItem value="completed">Realizada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Criar Visita
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Visitas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{visits?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Próximas Visitas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingVisits.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Visitas Realizadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedVisits.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Próximas Visitas
              </CardTitle>
            </CardHeader>
          <CardContent>
            {upcomingVisits.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma visita agendada</p>
            ) : (
              <div className="space-y-4">
                {upcomingVisits.map((visit: any) => (
                  <Card key={visit.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {visit.clients?.farm_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {visit.clients?.contact_name}
                          </p>
                        </div>
                        <Badge>Agendada</Badge>
                      </div>

                      {visit.scheduled_at && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <Clock className="h-4 w-4" />
                          {format(new Date(visit.scheduled_at), "PPpp", { locale: ptBR })}
                        </div>
                      )}

                      {visit.clients?.city && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <MapPin className="h-4 w-4" />
                          {visit.clients.city}, {visit.clients.state}
                        </div>
                      )}

                      {visit.objective && (
                        <div className="flex items-start gap-2 text-sm mb-2">
                          <FileText className="h-4 w-4 mt-0.5" />
                          <div>
                            <p className="font-medium">Objetivo:</p>
                            <p className="text-muted-foreground">{visit.objective}</p>
                          </div>
                        </div>
                      )}

                      {visit.notes && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">Observações:</p>
                          <p className="text-sm text-muted-foreground">{visit.notes}</p>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsCompleted(visit)}
                          className="flex-1"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Marcar como Realizada
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleUpdateStatus(visit.id, 'cancelled')}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visitas Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            {completedVisits.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma visita realizada</p>
            ) : (
              <div className="space-y-4">
                {completedVisits.map((visit: any) => (
                  <Card key={visit.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {visit.clients?.farm_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {visit.clients?.contact_name}
                          </p>
                        </div>
                        <Badge variant="outline">Realizada</Badge>
                      </div>

                      {visit.scheduled_at && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <Clock className="h-4 w-4" />
                          {format(new Date(visit.scheduled_at), "PPpp", { locale: ptBR })}
                        </div>
                      )}

                      {visit.clients?.city && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <MapPin className="h-4 w-4" />
                          {visit.clients.city}, {visit.clients.state}
                        </div>
                      )}

                      {visit.objective && (
                        <div className="flex items-start gap-2 text-sm mb-2">
                          <FileText className="h-4 w-4 mt-0.5" />
                          <div>
                            <p className="font-medium">Objetivo:</p>
                            <p className="text-muted-foreground">{visit.objective}</p>
                          </div>
                        </div>
                      )}

                      {visit.notes && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">O que aconteceu:</p>
                          <p className="text-sm text-muted-foreground">{visit.notes}</p>
                        </div>
                      )}

                      {visit.duration_min && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Duração: {visit.duration_min} minutos
                        </div>
                      )}

                      {(visit.notes || visit.objective) && (
                        <div className="mt-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewVisit(visit)}
                            className="w-full"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar Detalhes
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visitas Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            {cancelledVisits.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma visita cancelada</p>
            ) : (
              <div className="space-y-4">
                {cancelledVisits.map((visit: any) => (
                  <Card key={visit.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {visit.clients?.farm_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {visit.clients?.contact_name}
                          </p>
                        </div>
                        <Badge variant="destructive">Cancelada</Badge>
                      </div>

                      {visit.scheduled_at && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <Clock className="h-4 w-4" />
                          {format(new Date(visit.scheduled_at), "PPpp", { locale: ptBR })}
                        </div>
                      )}

                      {visit.clients?.city && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <MapPin className="h-4 w-4" />
                          {visit.clients.city}, {visit.clients.state}
                        </div>
                      )}

                      {visit.objective && (
                        <div className="flex items-start gap-2 text-sm mb-2">
                          <FileText className="h-4 w-4 mt-0.5" />
                          <div>
                            <p className="font-medium">Objetivo:</p>
                            <p className="text-muted-foreground">{visit.objective}</p>
                          </div>
                        </div>
                      )}

                      {visit.notes && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">Motivo do cancelamento:</p>
                          <p className="text-sm text-muted-foreground">{visit.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <AlertDialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
          <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Marcar Visita como Realizada</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedVisit && `Cliente: ${selectedVisit.clients?.farm_name || 'N/A'}`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>O que foi conversado? (Opcional)</Label>
                <Textarea
                  placeholder="Descreva o que foi conversado, decisões tomadas, próximos passos..."
                  value={completionDescription}
                  onChange={(e) => setCompletionDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Ações rápidas:</p>
                
                {!showOpportunityForm && !showDemoForm && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOpportunityForm(true)}
                    >
                      Nova Oportunidade
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDemoForm(true)}
                    >
                      Agendar Demonstração
                    </Button>
                  </div>
                )}

                {showOpportunityForm && (
                  <Card className="border-2 border-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Nova Oportunidade</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowOpportunityForm(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Estágio *</Label>
                        <Select
                          value={opportunityData.stage}
                          onValueChange={(value) => setOpportunityData({ ...opportunityData, stage: value as 'lead' | 'qualified' | 'proposal' | 'closing' | 'won' | 'lost' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="qualified">Qualificado</SelectItem>
                            <SelectItem value="proposal">Proposta</SelectItem>
                            <SelectItem value="closing">Fechamento</SelectItem>
                            <SelectItem value="won">Ganho</SelectItem>
                            <SelectItem value="lost">Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Probabilidade (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={opportunityData.probability}
                          onChange={(e) => setOpportunityData({ ...opportunityData, probability: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Estimado (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={opportunityData.gross_value}
                          onChange={(e) => setOpportunityData({ ...opportunityData, gross_value: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={opportunityData.notes}
                          onChange={(e) => setOpportunityData({ ...opportunityData, notes: e.target.value })}
                          rows={2}
                          placeholder="Detalhes sobre a oportunidade..."
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleCreateOpportunity}
                        size="sm"
                        className="w-full"
                      >
                        Criar Oportunidade
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {showDemoForm && (
                  <Card className="border-2 border-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Agendar Demonstração</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDemoForm(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[50vh] overflow-y-auto">
                      <div className="space-y-2">
                        <Label>Responsáveis</Label>
                        <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                          {users?.map((user) => (
                            <label key={user.auth_user_id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={demoData.assigned_users.includes(user.auth_user_id || '')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDemoData({
                                      ...demoData,
                                      assigned_users: [...demoData.assigned_users, user.auth_user_id || '']
                                    });
                                  } else {
                                    setDemoData({
                                      ...demoData,
                                      assigned_users: demoData.assigned_users.filter(id => id !== user.auth_user_id)
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{user.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Produtos Utilizados</Label>
                        <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-32 overflow-y-auto">
                          {products?.map((product) => (
                            <label key={product.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={demoData.products.includes(product.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDemoData({
                                      ...demoData,
                                      products: [...demoData.products, product.id]
                                    });
                                  } else {
                                    setDemoData({
                                      ...demoData,
                                      products: demoData.products.filter(id => id !== product.id)
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{product.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de Demonstração</Label>
                        <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                          {['semeadura', 'herbicida', 'inseticida', 'fungicida'].map((type) => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={demoData.demo_types.includes(type)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDemoData({
                                      ...demoData,
                                      demo_types: [...demoData.demo_types, type]
                                    });
                                  } else {
                                    setDemoData({
                                      ...demoData,
                                      demo_types: demoData.demo_types.filter(t => t !== type)
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm capitalize">{type}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Cultura</Label>
                        <Input
                          value={demoData.crop}
                          onChange={(e) => setDemoData({ ...demoData, crop: e.target.value })}
                          placeholder="Ex: Soja, Milho, Algodão..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Hectares</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={demoData.hectares}
                          onChange={(e) => setDemoData({ ...demoData, hectares: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Data e Hora *</Label>
                        <Input
                          type="datetime-local"
                          value={demoData.date}
                          onChange={(e) => setDemoData({ ...demoData, date: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={demoData.notes}
                          onChange={(e) => setDemoData({ ...demoData, notes: e.target.value })}
                          rows={2}
                          placeholder="Detalhes sobre a demonstração..."
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleScheduleDemonstration}
                        size="sm"
                        className="w-full"
                      >
                        Agendar Demonstração
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmCompletion}>
                Confirmar e Concluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Visita</DialogTitle>
            </DialogHeader>
            {selectedVisit && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    {selectedVisit.clients?.farm_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedVisit.clients?.contact_name}
                  </p>
                </div>

                {selectedVisit.scheduled_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>{format(new Date(selectedVisit.scheduled_at), "PPpp", { locale: ptBR })}</span>
                  </div>
                )}

                {selectedVisit.clients?.city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedVisit.clients.city}, {selectedVisit.clients.state}</span>
                  </div>
                )}

                {selectedVisit.objective && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Objetivo da Visita:</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm">{selectedVisit.objective}</p>
                    </div>
                  </div>
                )}

                {selectedVisit.notes && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">O que foi conversado:</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm">{selectedVisit.notes}</p>
                    </div>
                  </div>
                )}

                {selectedVisit.duration_min && (
                  <div className="text-sm text-muted-foreground">
                    Duração: {selectedVisit.duration_min} minutos
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
