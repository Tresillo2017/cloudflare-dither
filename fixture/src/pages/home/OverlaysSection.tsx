import {
  Button,
  Dialog,
  DropdownMenu,
  Popover,
  Tooltip,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { Copy } from "@phosphor-icons/react";
import { recordClick } from "../../app/clicks";

function ToastButton(): JSX.Element {
  const toasts = useKumoToastManager();
  return (
    <Button
      variant="secondary"
      onClick={() => {
        recordClick();
        toasts.add({ title: "Zone saved", description: "Changes are live." });
      }}
    >
      Show toast
    </Button>
  );
}

export function OverlaysSection(): JSX.Element {
  return (
    <section aria-label="Overlays" className="flex flex-wrap items-center gap-3">
      <Dialog.Root>
        <Dialog.Trigger render={(props) => <Button {...props}>Open dialog</Button>} />
        <Dialog size="sm">
          <Dialog.Title className="text-lg font-semibold">Delete zone?</Dialog.Title>
          <Dialog.Description className="text-kumo-subtle">
            This removes the zone and its DNS records. It cannot be undone.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close render={(props) => <Button {...props}>Cancel</Button>} />
            <Dialog.Close render={(props) => <Button {...props} variant="destructive" onClick={recordClick}>Delete</Button>} />
          </div>
        </Dialog>
      </Dialog.Root>

      <Popover.Root>
        <Popover.Trigger render={(props) => <Button {...props}>Open popover</Button>} />
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Title>Notifications</Popover.Title>
              <Popover.Description>You are all caught up.</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <DropdownMenu>
        <DropdownMenu.Trigger render={(props) => <Button {...props}>Actions</Button>} />
        <DropdownMenu.Content>
          <DropdownMenu.Item onClick={recordClick}>Rename</DropdownMenu.Item>
          <DropdownMenu.Item onClick={recordClick}>Duplicate</DropdownMenu.Item>
          <DropdownMenu.Item variant="danger" onClick={recordClick}>Delete</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

      <Tooltip
        content="Copy zone ID"
        render={<Button variant="ghost" shape="square" icon={<Copy />} aria-label="Copy zone ID" onClick={recordClick} />}
      />

      <ToastButton />
    </section>
  );
}
