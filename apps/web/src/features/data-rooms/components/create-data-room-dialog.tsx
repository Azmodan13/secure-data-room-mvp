'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateDataRoom } from '../mutations';
import { ApiError, getSuggestedName } from '@/lib/api/client';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a Data Room name.')
    .max(120, 'Use no more than 120 characters.'),
});

type FormValues = z.infer<typeof schema>;

export function CreateDataRoomDialog() {
  const [open, setOpen] = useState(false);
  const mutation = useCreateDataRoom();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (mutation.isPending) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      reset();
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      const dataRoom = await mutation.mutateAsync(values.name);

      toast.success(`“${dataRoom.name}” created.`);
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        const suggestedName = getSuggestedName(error.details);

        if (error.code === 'NAME_CONFLICT' && suggestedName) {
          setError('name', {
            message: `This name is already used. Try “${suggestedName}”.`,
          });
          return;
        }

        setError('root', {
          message: error.message,
        });
        return;
      }

      setError('root', {
        message: 'Unable to create the Data Room. Try again.',
      });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Plus className="size-4" />
          New Data Room
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />

        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Create Data Room
              </Dialog.Title>

              <Dialog.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Create a secure workspace for folders and documents.
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={mutation.isPending}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6" noValidate>
            <label
              htmlFor="data-room-name"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Name
            </label>

            <input
              id="data-room-name"
              autoFocus
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Project Atlas"
            />

            {errors.name ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {errors.name.message}
              </p>
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
                  disabled={mutation.isPending}
                  className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </Dialog.Close>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex min-w-20 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {mutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}

                {mutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
