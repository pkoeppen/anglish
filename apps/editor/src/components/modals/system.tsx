"use client";

import type { Component, ComponentProps, JSX, ParentProps } from "solid-js";
import { createContext, createEffect, createSignal, For, useContext } from "solid-js";

interface ModalContextType<T extends Record<string, Component<any>>> {
  openModalWithId: <K extends keyof T>(
    id: K,
    modalProps: keyof ComponentProps<T[K]> extends never
      ? undefined
      : ComponentProps<T[K]>,
  ) => void;
  closeModal: (options?: { hard?: boolean }) => void;
  closeAll: () => void;
}

type GetModalProps<
  T extends Record<string, Component<any>>,
  M extends keyof T,
> = unknown extends keyof ComponentProps<T[M]>
  ? []
  : undefined extends ComponentProps<T[M]>
    ? [props?: ComponentProps<T[M]>]
    : [props: ComponentProps<T[M]>];

type UseModalType<
  T extends Record<string, Component<any>>,
  K extends keyof T | undefined,
> = K extends undefined
  ? {
      openModal: {
        <M extends keyof T>(id: M, ...args: GetModalProps<T, M>): void;
      };
      closeModal: (options?: { animate?: boolean }) => void;
      closeAll: () => void;
    }
  : {
      openModal: (...args: GetModalProps<T, NonNullable<K>>) => void;
      closeModal: (options?: { animate?: boolean }) => void;
      closeAll: () => void;
    };

interface ModalRef<T extends HTMLElement> {
  current: T | null;
}

interface ModalStackItem<T extends Record<string, Component<any>>, K extends keyof T> {
  id: K;
  props: ComponentProps<T[K]>;
  ref: ModalRef<HTMLDivElement>;
}

export function createModalSystem<T extends Record<string, Component<any>>>(
  modals: T,
) {
  const ModalContext = createContext<ModalContextType<T> | undefined>(
    undefined,
  );

  function ModalProvider(props: ParentProps) {
    const [modalStack, setModalStack] = createSignal<ModalStackItem<T, keyof T>[]>(
      [],
    );
    let containerRef: HTMLDivElement | undefined;

    const animate = (
      ref: ModalRef<HTMLElement> | undefined,
      key: "in" | "out",
      animateContainer: boolean,
    ) => {
      return new Promise<void>((resolve) => {
        if (!ref?.current) {
          resolve();
          return;
        }
        if (animateContainer && !containerRef) {
          resolve();
          return;
        }

        if (key === "in") {
          if (animateContainer && containerRef) {
            containerRef.style.display = "block";
            containerRef.scrollTop = 0;
          }
          ref.current.style.display = "flex";
        }

        void document.body.offsetHeight;

        if (animateContainer && containerRef)
          containerRef.style.opacity = key === "in" ? "0" : "1";
        ref.current.style.opacity = key === "in" ? "0" : "1";
        ref.current.style.transform
          = key === "in" ? "translateY(1rem)" : "translateY(0)";

        void document.body.offsetHeight;

        requestAnimationFrame(() => {
          if (!ref.current) {
            resolve();
            return;
          }
          if (animateContainer && !containerRef) {
            resolve();
            return;
          }

          void document.body.offsetHeight;
          if (animateContainer && containerRef)
            containerRef.style.opacity = key === "in" ? "1" : "0";
          void document.body.offsetHeight;
          ref.current.style.opacity = key === "in" ? "1" : "0";
          ref.current.style.transform
            = key === "in" ? "translateY(0)" : "translateY(1rem)";
          void document.body.offsetHeight;

          const cleanup = () => {
            if (!ref.current) {
              resolve();
              return;
            }

            ref.current.removeEventListener("transitionend", cleanup);
            if (key === "out") {
              if (animateContainer && containerRef)
                containerRef.style.display = "none";
              ref.current.style.display = "none";
            }
            void document.body.offsetHeight;
            resolve();
          };
          ref.current.addEventListener("transitionend", cleanup);
        });
      });
    };

    createEffect(() => {
      if (modalStack().length === 0) {
        document.body.style.overflow = "auto";
      }
      else {
        document.body.style.overflow = "hidden";
      }
    });

    const closeModal = async () => {
      const currentStack = modalStack();
      const hideRef = currentStack[currentStack.length - 1]?.ref;
      const showRef = currentStack[currentStack.length - 2]?.ref;

      await animate(hideRef, "out", !showRef);
      if (showRef)
        await animate(showRef, "in", true);
      void document.body.offsetHeight;

      setModalStack(prev => prev.slice(0, -1));
    };

    const closeAll = async () => {
      const currentStack = modalStack();
      const hideRef = currentStack[currentStack.length - 1]?.ref;
      await animate(hideRef, "out", true);
      setModalStack([]);
    };

    const openModalWithId: ModalContextType<T>["openModalWithId"] = (
      id,
      props?: any,
    ) => {
      const currentStack = modalStack();
      const hideRef = currentStack[currentStack.length - 1]?.ref;
      const showRef: ModalRef<HTMLDivElement> = { current: null };

      (async () => {
        setModalStack(prev => [
          ...prev,
          { id, props: (props || {}) as ComponentProps<T[keyof T]>, ref: showRef },
        ]);

        await waitForRef(showRef);
        if (hideRef)
          await animate(hideRef, "out", false);
        await animate(showRef, "in", true);
      })();
    };

    return (
      <ModalContext.Provider value={{ openModalWithId, closeModal, closeAll }}>
        {props.children}
        <div
          ref={el => (containerRef = el)}
          style={{
            "position": "fixed",
            "inset": 0,
            "z-index": 50,
            "overflow-y": "auto",
            "background-color": "rgba(0, 0, 0, 0.5)",
            "opacity": 0,
            "transition": "opacity 200ms ease-in-out",
            "pointer-events": modalStack().length ? "auto" : "none",
            "display": "none",
          }}
        >
          <For each={modalStack()}>
            {(item) => {
              const ModalComponent = modals[item.id];
              return (
                <div
                  ref={el => (item.ref.current = el)}
                  style={{
                    "opacity": 0,
                    "min-height": "100%",
                    "width": "100%",
                    "justify-content": "center",
                    "align-items": "center",
                    "transition": "all 200ms ease-in-out",
                    "transform": "translateY(1rem)",
                    "display": "none",
                  } satisfies JSX.CSSProperties}
                >
                  <ModalComponent {...item.props} />
                </div>
              );
            }}
          </For>
        </div>
      </ModalContext.Provider>
    );
  }

  function useModal(): UseModalType<T, undefined>;
  function useModal<K extends keyof T>(id: K): UseModalType<T, K>;
  function useModal<K extends keyof T | undefined>(id?: K): UseModalType<T, K> {
    const context = useContext(ModalContext);

    if (!context) {
      throw new Error("useModal must be used within a ModalProvider");
    }

    if (!id) {
      return {
        openModal: (id: keyof T, ...args: GetModalProps<T, NonNullable<K>>) => {
          context.openModalWithId(
            id,
            args[0] as ComponentProps<T[NonNullable<K>]>,
          );
        },
        closeModal: (options?: { hard?: boolean }) => {
          context.closeModal(options);
        },
        closeAll: () => {
          context.closeAll();
        },
      } as UseModalType<T, K>;
    }

    return {
      openModal: (...args: GetModalProps<T, NonNullable<K>>) => {
        context.openModalWithId(
          id,
          args[0] as ComponentProps<T[NonNullable<K>]>,
        );
      },
      closeModal: (options?: { hard?: boolean }) => {
        context.closeModal(options);
      },
      closeAll: () => {
        context.closeAll();
      },
    } as UseModalType<T, K>;
  }

  return {
    ModalProvider,
    useModal,
  };
}

function waitForRef(ref: ModalRef<HTMLElement>) {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (ref.current) {
        resolve();
      }
      else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}
