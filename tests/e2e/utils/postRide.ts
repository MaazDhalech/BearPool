import type { Screen } from "@mobilewright/core";

/**
 * Fills out and submits the "Post a ride" form, then dismisses the success
 * modal back to the home feed. Assumes the caller is already signed in and
 * currently on any tab screen (navigates to the Post tab itself).
 */
export async function postRide(
  screen: Screen,
  opts: { from: string; to: string },
): Promise<void> {
  // The native bottom tab bar isn't part of this ticket's testID surface,
  // so we target it by its visible label.
  await screen.getByRole("button", { name: "Post" }).tap();

  await screen.getByTestId("post-ride-from-input").fill(opts.from);
  await screen.getByTestId("post-ride-to-input").fill(opts.to);

  // `date` defaults to "now" at mount, which fails the app's
  // must-be-in-the-future validation by the time the form is submitted a few
  // seconds later. Bump the date forward a day via the native spinner so the
  // ride stays valid regardless of how long the fields above took to fill.
  await screen.getByTestId("post-ride-date-button").tap();
  await screen.getByTestId("post-ride-date-picker").swipe({ direction: "up" });
  await screen.getByTestId("post-ride-date-done-button").tap();

  await screen.getByTestId("post-ride-submit-button").tap();

  // Dismiss the "Ride is live" success modal back to the home feed.
  await screen.getByTestId("post-ride-success-home-button").tap();
}
