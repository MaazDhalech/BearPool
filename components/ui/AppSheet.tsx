import { useTheme } from "@/hooks/useTheme";
import React from "react";
// NOTE: @lodev09/react-native-true-sheet ships bundler-style type entrypoints.
// This project's tsconfig uses moduleResolution "nodenext", which can't follow
// the package's extensionless type re-exports, so a named `import { TrueSheet }`
// fails typecheck even though Metro resolves the runtime correctly. We import the
// namespace (which always resolves) and read the component off it.
import * as TrueSheetModule from "@lodev09/react-native-true-sheet";

const TrueSheet = (
  TrueSheetModule as unknown as { TrueSheet: React.ComponentType<any> }
).TrueSheet;

/** Imperative handle for AppSheet: `ref.current?.present()` / `.dismiss()`. */
export type AppSheetRef = {
  present: (index?: number) => Promise<void>;
  dismiss: () => Promise<void>;
  resize: (index: number) => Promise<void>;
};

type AppSheetProps = React.ComponentProps<typeof TrueSheet> & {
  children?: React.ReactNode;
};

/**
 * Themed native bottom sheet (callit-style). Thin wrapper over TrueSheet that
 * applies BearPool's dark surface, rounded corners and a grabber by default.
 *
 * Usage:
 *   const ref = useRef<AppSheetRef>(null);
 *   <AppSheet ref={ref} detents={["auto"]}> ...content... </AppSheet>
 *   ref.current?.present();  // and ref.current?.dismiss();
 */
export const AppSheet = React.forwardRef<AppSheetRef, AppSheetProps>(
  function AppSheet(props, ref) {
    const t = useTheme();
    return (
      <TrueSheet
        ref={ref as any}
        cornerRadius={20}
        grabber
        backgroundColor={t.surface}
        {...props}
      />
    );
  },
);
