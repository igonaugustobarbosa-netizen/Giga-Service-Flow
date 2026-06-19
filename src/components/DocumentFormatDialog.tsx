import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { FileText, File as FileIcon } from 'lucide-react';

interface DocumentFormatDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (format: 'pdf' | 'word', detailedLabor?: boolean, detailedKM?: boolean) => void;
  title?: string;
  description?: string;
}

export function DocumentFormatDialog({
  isOpen,
  onOpenChange,
  onSelect,
  title = "Escolha o Formato do Documento",
  description = "Como você deseja gerar este documento?"
}: DocumentFormatDialogProps) {
  const [detailedLabor, setDetailedLabor] = React.useState(false);
  const [detailedKM, setDetailedKM] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-muted-foreground text-sm">{description}</p>
        </DialogHeader>
        
        <div className="space-y-3 py-2 px-1">
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="detailedLabor" 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              checked={detailedLabor}
              onChange={(e) => setDetailedLabor(e.target.checked)}
            />
            <label 
              htmlFor="detailedLabor" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Incluir detalhamento de horas por técnico
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="detailedKM" 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              checked={detailedKM}
              onChange={(e) => setDetailedKM(e.target.checked)}
            />
            <label 
              htmlFor="detailedKM" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Incluir detalhamento de KM por técnico
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center h-32 gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
            onClick={() => onSelect('pdf', detailedLabor, detailedKM)}
          >
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="font-bold">PDF</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Documento Fixo</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col items-center justify-center h-32 gap-3 border-2 hover:border-blue-600 hover:bg-blue-50 transition-all group"
            onClick={() => onSelect('word', detailedLabor, detailedKM)}
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <FileIcon className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="font-bold">Word</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Editável (.docx)</p>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
