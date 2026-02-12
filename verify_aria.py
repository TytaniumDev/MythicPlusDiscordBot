from playwright.sync_api import sync_playwright, expect
import time

def verify_accessibility():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        print("Navigating to app...")
        page.goto("http://localhost:5173/")

        # Wait for the app to load
        page.wait_for_selector("#app")

        # Verify ARIA labels on Wheels
        print("Verifying Wheel ARIA labels...")
        tank_wheel = page.locator("#wheel-tank")
        expect(tank_wheel).to_have_attribute("aria-label", "Tank Selection Wheel")
        expect(tank_wheel).to_have_attribute("role", "img")

        healer_wheel = page.locator("#wheel-healer")
        expect(healer_wheel).to_have_attribute("aria-label", "Healer Selection Wheel")
        expect(healer_wheel).to_have_attribute("role", "img")

        dps_wheel = page.locator("#wheel-dps")
        expect(dps_wheel).to_have_attribute("aria-label", "DPS Selection Wheel")
        expect(dps_wheel).to_have_attribute("role", "img")

        # Verify ARIA live regions
        print("Verifying Live Regions...")
        status_msg = page.locator("#status-message")
        expect(status_msg).to_have_attribute("aria-live", "polite")

        formed_groups = page.locator("#formed-groups-list")
        expect(formed_groups).to_have_attribute("aria-live", "polite")

        result_tank = page.locator("#result-tank")
        expect(result_tank).to_have_attribute("aria-live", "polite")
        expect(result_tank).to_have_attribute("aria-atomic", "true")

        # Verify decorative elements are hidden
        print("Verifying Decorative Elements...")
        arrow = page.locator(".arrow").first
        # Since arrow is hidden, we check attribute
        expect(arrow).to_have_attribute("aria-hidden", "true")

        # Take screenshot
        print("Taking screenshot...")
        # Make sure wheels are visible (they are hidden by default in Lobby view, but exist in DOM)
        # We need to simulate entering the wheel view or just check DOM attributes even if hidden.
        # But wait, .hidden class uses display: none !important.
        # If display: none, playwright might not find them if we use strict visibility checks?
        # But locator() finds them regardless of visibility unless we ask for visible only.
        # However, taking a screenshot of hidden elements won't show them.
        # Let's switch to Demo Mode to show wheels.

        # Click "Start Demo" if visible (demo controls are hidden initially until no session found)
        # The script waits for session. If no session, demo controls appear.
        # But mock data logic in main.ts shows demo controls if no session ID.

        # Let's wait for demo controls to appear
        try:
            demo_btn = page.locator("#start-demo-btn")
            if demo_btn.is_visible():
                demo_btn.click()
                # Wait for lobby to disappear and wheels to appear
                # Actually demo starts in Lobby mode with mock data, then we can click Spin?
                # Let's see main.ts: startDemo() calls handleSessionUpdate(mockSession).
                # mockSession starts in 'lobby' state.
                # Then we can click spin?
                # But to see wheels we need to be in 'spinning' or 'completed' state?
                # Or we can just inspect the DOM attributes which we already did.
                pass
        except:
            pass

        page.screenshot(path="verification_screenshot.png", full_page=True)
        print("Verification Successful!")

        browser.close()

if __name__ == "__main__":
    verify_accessibility()
