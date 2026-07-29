Feature: Matrix Compass responsive dashboard
  As a multi-platform content operator
  I want the dashboard and demo backend to work consistently
  So that I can inspect growth and risk signals on desktop and mobile

  Scenario: Load the default demo dashboard
    Given the demo backend is healthy
    When I request the dashboard without a range
    Then the response uses the 30 day range
    And the response is explicitly marked as demo data

  Scenario Outline: Switch to a supported reporting range
    When I request the dashboard for <range> days
    Then the response uses the <range> day range
    And the response contains four summary metrics

    Examples:
      | range |
      | 7     |
      | 30    |
      | 90    |

  Scenario: Reject an unsupported reporting range
    When I request the dashboard for 14 days
    Then the response status is 400
    And the response error code is "INVALID_RANGE"

  Scenario: Reach every confirmed product module
    Given the dashboard view is rendered for account management
    Then the primary navigation exposes every confirmed module
    And account management is the current page

  Scenario: Support a phone viewport without fixed desktop width
    Given the responsive stylesheet is loaded
    Then a 767 pixel mobile breakpoint exists
    And the former 1024 pixel minimum width is absent
    And touch targets have a 44 pixel minimum height
