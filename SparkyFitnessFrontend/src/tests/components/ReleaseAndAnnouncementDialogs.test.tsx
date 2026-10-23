import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import NewReleaseDialog, { ReleaseInfo } from '@/components/NewReleaseDialog';
import AnnouncementDialog, {
  AnnouncementInfo,
} from '@/components/AnnouncementDialog';

const release: ReleaseInfo = {
  version: 'v1.9.0',
  releaseNotes: 'Short notes',
  publishedAt: '2026-10-20T00:00:00Z',
  htmlUrl: 'https://github.com/CodeWithCJ/SparkyFitness/releases/tag/v1.9.0',
  isNewVersionAvailable: true,
};

const announcement: AnnouncementInfo = {
  id: 'notice-1',
  active: true,
  title: 'Heads up',
  message: 'Something happened',
  publishedAt: '2026-10-20T00:00:00Z',
};

// A full mouse press outside the dialog. Radix only listens for outside clicks
// from the tick after mount, and dismisses on the click that follows pointerdown.
const clickOutside = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  fireEvent.pointerDown(document.body, { button: 0, pointerId: 1 });
  fireEvent.mouseDown(document.body, { button: 0 });
  fireEvent.pointerUp(document.body, { button: 0, pointerId: 1 });
  fireEvent.mouseUp(document.body, { button: 0 });
  fireEvent.click(document.body, { button: 0 });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('NewReleaseDialog', () => {
  afterEach(cleanup);

  it('can be dismissed immediately, without scrolling or acknowledging', () => {
    const onClose = jest.fn();
    render(<NewReleaseDialog isOpen onClose={onClose} releaseInfo={release} />);

    const button = screen.getByRole('button', {
      name: /don't show again for this version/i,
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with the X button', () => {
    const onClose = jest.fn();
    render(<NewReleaseDialog isOpen onClose={onClose} releaseInfo={release} />);
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Escape', () => {
    const onClose = jest.fn();
    render(<NewReleaseDialog isOpen onClose={onClose} releaseInfo={release} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking outside', async () => {
    const onClose = jest.fn();
    render(<NewReleaseDialog isOpen onClose={onClose} releaseInfo={release} />);
    await clickOutside();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not require typing BREAKING for a breaking release', () => {
    const onClose = jest.fn();
    render(
      <NewReleaseDialog
        isOpen
        onClose={onClose}
        releaseInfo={{ ...release, releaseNotes: 'This is a breaking change.' }}
      />
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /don't show again for this version/i })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AnnouncementDialog', () => {
  afterEach(cleanup);

  it('closes with the button, X, Escape and click outside', async () => {
    const onClose = jest.fn();
    render(
      <AnnouncementDialog
        isOpen
        onClose={onClose}
        announcement={announcement}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /got it, don't show again/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await clickOutside();
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
