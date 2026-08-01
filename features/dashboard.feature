Feature: Matrix Compass real-data operations shell
  As a multi-platform creator
  I want demo data and my local records to remain clearly separated
  So that I can manage content, schedules, and income without mistaking samples for facts

  Scenario: Load the isolated demo workspace
    When I request the demo bootstrap
    Then the bootstrap is explicitly read-only demo data
    And the bootstrap contains the isolated demo metrics

  Scenario: Start with an empty local database
    When I request the bootstrap for an empty local database
    Then the bootstrap requires onboarding
    And the bootstrap offers Feishu, file import, and manual creation
    And the bootstrap contains no financial metrics

  Scenario: Reach every confirmed product module
    Given the operations view is rendered for income management
    Then the operations navigation exposes every confirmed module
    And income management is the current page

  Scenario: Support a phone viewport without fixed desktop width
    Given the responsive stylesheet is loaded
    Then a 767 pixel mobile breakpoint exists
    And the former 1024 pixel minimum width is absent
    And operations touch targets have a 44 pixel minimum height
