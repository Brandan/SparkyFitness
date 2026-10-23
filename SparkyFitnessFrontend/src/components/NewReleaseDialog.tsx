import type React from 'react';
import { AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { Trans, useTranslation } from 'react-i18next';
export interface ReleaseInfo {
  version: string;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  isNewVersionAvailable: boolean;
}

interface NewReleaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  releaseInfo: ReleaseInfo | null;
}

const formatGithubReleaseNotes = (notes: string): string => {
  if (!notes) return '';

  let formatted = notes;

  // 1. Convert GitHub pull request URLs to [#PR_NUMBER](URL)
  formatted = formatted.replace(
    /https:\/\/github\.com\/CodeWithCJ\/SparkyFitness\/pull\/(\d+)/g,
    '[#$1](https://github.com/CodeWithCJ/SparkyFitness/pull/$1)'
  );

  // 2. Convert GitHub commit URLs to [commit_hash](URL)
  formatted = formatted.replace(
    /https:\/\/github\.com\/CodeWithCJ\/SparkyFitness\/commit\/([a-f0-9]{7,40})/g,
    (match, hash) => `[\`${hash.slice(0, 7)}\`](${match})`
  );

  // 3. Convert @username mentions to [@username](https://github.com/username)
  // Avoid matching email addresses by requiring @ to be preceded by non-alphanumeric/start
  formatted = formatted.replace(
    /(^|[^a-zA-Z0-9_[])@([a-zA-Z0-9-]+)/g,
    '$1[@$2](https://github.com/$2)'
  );

  return formatted;
};

const NewReleaseDialog: React.FC<NewReleaseDialogProps> = ({
  isOpen,
  onClose,
  releaseInfo,
}) => {
  const { t } = useTranslation();

  if (!releaseInfo) {
    return null;
  }

  const hasBreakingChange = releaseInfo.releaseNotes
    ?.toLowerCase()
    .includes('breaking change');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        {hasBreakingChange && (
          <div className="bg-red-500 text-white font-bold p-3 text-center text-xs flex items-center justify-center gap-2 rounded-t-lg -mx-6 -mt-6 mb-4">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {t(
                'newReleaseDialog.criticalWARNINGTHISRELEASECONTAINS',
                'CRITICAL WARNING: THIS RELEASE CONTAINS BREAKING CHANGES!'
              )}
            </span>
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t(
              'newReleaseDialog.newVersionAvailable',
              'New Version Available: {{version}}',
              { version: releaseInfo.version }
            )}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2 mt-2">
              <p>
                {t(
                  'newReleaseDialog.aNewVersionOfSparkyFitness',
                  'A new version of SparkyFitness is available!'
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('newReleaseDialog.published2', 'Published: {{value}}', {
                  value: new Date(releaseInfo.publishedAt).toLocaleDateString(),
                })}
              </p>

              <div className="mt-3 p-3 border border-border rounded-md max-h-[50vh] overflow-y-auto bg-muted/30">
                <h3 className="font-semibold mb-2 text-sm text-foreground">
                  {t('newReleaseDialog.releaseNotes', 'Release Notes:')}
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-foreground leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ ...props }) => (
                        <h1
                          className="text-base font-bold mt-3 mb-2 border-b pb-1 text-foreground"
                          {...props}
                        />
                      ),
                      h2: ({ ...props }) => (
                        <h2
                          className="text-sm font-semibold mt-2 mb-1 text-foreground"
                          {...props}
                        />
                      ),
                      h3: ({ ...props }) => (
                        <h3
                          className="text-xs font-semibold mt-2 mb-1 text-foreground"
                          {...props}
                        />
                      ),
                      p: ({ ...props }) => (
                        <p className="mb-2 whitespace-pre-wrap" {...props} />
                      ),
                      ul: ({ ...props }) => (
                        <ul
                          className="list-disc pl-4 mb-2 space-y-1"
                          {...props}
                        />
                      ),
                      ol: ({ ...props }) => (
                        <ol
                          className="list-decimal pl-4 mb-2 space-y-1"
                          {...props}
                        />
                      ),
                      li: ({ ...props }) => (
                        <li className="mb-0.5 whitespace-pre-wrap" {...props} />
                      ),
                      code: ({ ...props }) => (
                        <code
                          className="bg-muted px-1 py-0.5 rounded font-mono text-[11px]"
                          {...props}
                        />
                      ),
                      pre: ({ ...props }) => (
                        <pre
                          className="bg-muted p-2 rounded overflow-x-auto my-2 font-mono text-[11px] border"
                          {...props}
                        />
                      ),
                      blockquote: ({ ...props }) => (
                        <blockquote
                          className="border-l-2 border-muted-foreground/30 pl-3 italic my-2 text-muted-foreground"
                          {...props}
                        />
                      ),
                      a: ({ href, children, ...props }) => {
                        const isPrLink = href?.startsWith(
                          'https://github.com/CodeWithCJ/SparkyFitness/pull/'
                        );
                        const isUserLink =
                          href?.startsWith('https://github.com/') &&
                          !href.includes('/', 19);

                        if (isUserLink) {
                          return (
                            <a
                              href={href}
                              className="bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 font-semibold px-1 py-0.5 rounded hover:underline text-[11px]"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        }

                        return (
                          <a
                            href={href}
                            className={cn(
                              'text-blue-500 hover:underline font-medium',
                              isPrLink &&
                                'font-semibold text-blue-600 dark:text-blue-400'
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {formatGithubReleaseNotes(releaseInfo.releaseNotes)}
                  </ReactMarkdown>
                </div>
              </div>

              <p className="mt-4 text-xs">
                <Trans
                  i18nKey="newReleaseDialog.viewOnGitHub2"
                  defaults={'View on GitHub: <link>{{htmlUrl}}</link>'}
                  values={{ htmlUrl: releaseInfo.htmlUrl }}
                  components={{
                    link: (
                      <a
                        href={releaseInfo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      />
                    ),
                  }}
                />
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 sm:justify-center">
          <Button onClick={onClose} className="w-full sm:w-auto">
            {t(
              'newReleaseDialog.donTShowAgainFor',
              "Don't show again for this version"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewReleaseDialog;
