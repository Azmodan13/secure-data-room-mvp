'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, X } from 'lucide-react';
import { type ReactNode, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError, getSuggestedName } from '@/lib/api/client';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(120, 'Use no more than 120 characters.'),
});

type FormValues = z.infer<typeof schema>;

type RenameDialogProps = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  resourceLabel: string;
  currentName: string;
  fixedSuffix?: string;
  isPending: boolean;
  onRename: (name: string) => Promise<unknown>;
  onSuccess?: (name: string) => void;
};

export function RenameDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  resourceLabel,
  currentName,
  fixedSuffix,
  isPending,
  onRename,
  onSuccess,
}: RenameDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const open = controlledOpen ?? internalOpen;

  function updateOpen(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editableCurrentName =
    fixedSuffix && currentName.toLowerCase().endsWith(fixedSuffix.toLowerCase())
      ? currentName.slice(0, -fixedSuffix.length)
      : currentName;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editableCurrentName,
    },
  });
  const nameField = register('name');

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) {
      return;
    }

    updateOpen(nextOpen);

    if (nextOpen) {
      reset({ name: editableCurrentName });
      setConflictMessage(null);
    }
  }

  async function onSubmit(values: FormValues) {
    setConflictMessage(null);
    const nextName = `${values.name}${fixedSuffix ?? ''}`;

    if (nextName.length > 120) {
      setError('name', {
        message: `Use no more than ${120 - (fixedSuffix?.length ?? 0)} characters.`,
      });
      return;
    }

    if (nextName === currentName) {
      updateOpen(false);
      return;
    }

    try {
      await onRename(nextName);
      onSuccess?.(nextName);
      updateOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        const suggestedName = getSuggestedName(error.details);

        if (error.code === 'NAME_CONFLICT' && suggestedName) {
          const editableSuggestion =
            fixedSuffix &&
            suggestedName.toLowerCase().endsWith(fixedSuffix.toLowerCase())
              ? suggestedName.slice(0, -fixedSuffix.length)
              : suggestedName;

          setValue('name', editableSuggestion, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setConflictMessage(
            `A ${resourceLabel.toLowerCase()} with this name already exists here. We changed the proposal to “${suggestedName}” so both can be kept. Review the new name and click Save again.`,
          );
          return;
        }

        setError('root', {
          message: error.message,
        });
        return;
      }

      setError('root', {
        message: `Unable to rename this ${resourceLabel.toLowerCase()}.`,
      });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />

        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Rename {resourceLabel}
              </Dialog.Title>

              <Dialog.Description className="mt-1 [overflow-wrap:anywhere] text-sm text-zinc-500 dark:text-zinc-400">
                Enter a new name for “{currentName}”.
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={isPending}
                className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6" noValidate>
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Name
            </label>

            <div className="mt-2 flex w-full items-center rounded-lg border border-zinc-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950">
              <input
                id={inputId}
                autoFocus
                autoComplete="off"
                maxLength={120 - (fixedSuffix?.length ?? 0)}
                aria-invalid={Boolean(errors.name)}
                {...nameField}
                ref={(element) => {
                  nameField.ref(element);
                  inputRef.current = element;
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-zinc-950 outline-none dark:text-zinc-50"
              />
              {fixedSuffix ? (
                <span className="shrink-0 border-l border-zinc-200 px-3 py-2.5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  {fixedSuffix}
                </span>
              ) : null}
            </div>

            {errors.name ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {errors.name.message}
              </p>
            ) : null}

            {conflictMessage ? (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <p className="font-medium">Name already in use</p>
                <p className="mt-1">{conflictMessage}</p>
              </div>
            ) : null}

            {errors.root ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {errors.root.message}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isPending}
                  className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </Dialog.Close>

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-w-20 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}

                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
