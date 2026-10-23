import type React from 'react';
import { Megaphone } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { useTranslation } from 'react-i18next';
export interface AnnouncementInfo {
  id: string;
  active: boolean;
  title: string;
  message: string;
  publishedAt?: string;
  htmlUrl?: string;
}

interface AnnouncementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: AnnouncementInfo | null;
}

const AnnouncementDialog: React.FC<AnnouncementDialogProps> = ({
  isOpen,
  onClose,
  announcement,
}) => {
  const { t } = useTranslation();
  if (!announcement || !announcement.active) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl border border-primary/20 bg-background text-foreground shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 flex-row items-center justify-between space-y-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {announcement.title ||
                  t('announcementDialog.announcement', 'Announcement')}
              </DialogTitle>
              {announcement.publishedAt && (
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('announcementDialog.published2', 'Published: {{value}}', {
                    value: new Date(
                      announcement.publishedAt
                    ).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }),
                  })}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto flex-1 text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {announcement.message}
          </ReactMarkdown>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 flex items-center justify-end space-x-3 bg-muted/20">
          <Button onClick={onClose} className="px-5 rounded-lg">
            {t('announcementDialog.gotItDonTShow', "Got it, don't show again")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementDialog;
