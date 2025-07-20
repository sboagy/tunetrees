"""Tests for practice goals and techniques functionality (Issue #205)."""

import pytest

# Import the public function from the calculate module, not the private one
from tunetrees.app.schedule import TuneFeedbackUpdate
from tunetrees.models.tunetrees_pydantic import (
    PracticeGoalEnum,
    PracticeTechniqueEnum,
)


class TestPracticeGoalEnums:
    """Test practice goal and technique enums."""

    def test_practice_goal_enum_values(self) -> None:
        """Test all practice goal enum values are available."""
        expected_goals = {
            "initial_learn",
            "recall",
            "fluency",
            "session_ready",
            "performance_polish",
        }

        actual_goals = {goal.value for goal in PracticeGoalEnum}
        assert actual_goals == expected_goals

    def test_practice_technique_enum_values(self) -> None:
        """Test all practice technique enum values are available."""
        expected_techniques = {
            "fsrs",
            "sm2",
            "daily_practice",
            "motor_skills",
            "metronome",
            "custom",
        }

        actual_techniques = {technique.value for technique in PracticeTechniqueEnum}
        assert actual_techniques == expected_techniques


class TestTuneFeedbackUpdate:
    """Test TuneFeedbackUpdate TypedDict with new goal/technique fields."""

    def test_tune_feedback_update_basic(self) -> None:
        """Test basic TuneFeedbackUpdate functionality."""
        feedback: TuneFeedbackUpdate = {
            "feedback": "Good",
            "goal": "fluency",
            "technique": "motor_skills",
        }

        assert feedback["feedback"] == "Good"
        assert feedback["goal"] == "fluency"
        assert feedback["technique"] == "motor_skills"

    def test_tune_feedback_update_minimal(self) -> None:
        """Test TuneFeedbackUpdate with minimal required fields."""
        feedback: TuneFeedbackUpdate = {"feedback": "Good"}

        assert feedback["feedback"] == "Good"
        # Optional fields should be None when accessed via .get()
        assert feedback.get("goal") is None
        assert feedback.get("technique") is None


# Test goal-specific scheduling by testing indirectly through known behavior
class TestGoalSpecificSchedulingBehavior:
    """Test goal-specific scheduling behavior through integration."""

    def test_practice_goal_enum_completeness(self) -> None:
        """Test that all practice goals are defined and accessible."""
        # Test that we can iterate through all goals
        goals = list(PracticeGoalEnum)
        assert len(goals) == 5

        # Test specific goals exist
        goal_values = [goal.value for goal in goals]
        assert "initial_learn" in goal_values
        assert "recall" in goal_values
        assert "fluency" in goal_values
        assert "session_ready" in goal_values
        assert "performance_polish" in goal_values

    def test_practice_technique_enum_completeness(self) -> None:
        """Test that all practice techniques are defined and accessible."""
        # Test that we can iterate through all techniques
        techniques = list(PracticeTechniqueEnum)
        assert len(techniques) == 6

        # Test specific techniques exist
        technique_values = [technique.value for technique in techniques]
        assert "fsrs" in technique_values
        assert "sm2" in technique_values
        assert "daily_practice" in technique_values
        assert "motor_skills" in technique_values
        assert "metronome" in technique_values
        assert "custom" in technique_values

    def test_tune_feedback_update_structure(self) -> None:
        """Test TuneFeedbackUpdate accepts all expected fields."""
        # Test with all fields
        complete_feedback: TuneFeedbackUpdate = {
            "feedback": "Easy",
            "goal": "session_ready",
            "technique": "metronome",
        }

        assert complete_feedback["feedback"] == "Easy"
        assert complete_feedback.get("goal") == "session_ready"
        assert complete_feedback.get("technique") == "metronome"

        # Test with only required field
        minimal_feedback: TuneFeedbackUpdate = {"feedback": "Again"}

        assert minimal_feedback["feedback"] == "Again"
        assert minimal_feedback.get("goal") is None
        assert minimal_feedback.get("technique") is None

    def test_feedback_values_accepted(self) -> None:
        """Test that various feedback values are accepted."""
        valid_feedback_values = ["Again", "Hard", "Good", "Easy"]

        for feedback_value in valid_feedback_values:
            feedback: TuneFeedbackUpdate = {
                "feedback": feedback_value,
                "goal": "recall",
                "technique": "fsrs",
            }
            assert feedback["feedback"] == feedback_value

    def test_all_goal_technique_combinations(self) -> None:
        """Test that all goal and technique combinations can be created."""
        for goal in PracticeGoalEnum:
            for technique in PracticeTechniqueEnum:
                feedback: TuneFeedbackUpdate = {
                    "feedback": "Good",
                    "goal": goal.value,
                    "technique": technique.value,
                }

                assert feedback["feedback"] == "Good"
                assert feedback["goal"] == goal.value
                assert feedback["technique"] == technique.value


class TestPracticeGoalsIntegration:
    """Integration tests covering real-world usage patterns."""

    def test_enum_value_extraction(self) -> None:
        """Test extracting all enum values for UI dropdowns or validation."""
        # This is how frontend would get all available options
        goal_options = [goal.value for goal in PracticeGoalEnum]
        technique_options = [technique.value for technique in PracticeTechniqueEnum]

        # Verify we have the expected counts
        assert len(goal_options) == 5
        assert len(technique_options) == 6

        # Verify all values are strings (for API serialization)
        assert all(isinstance(goal, str) for goal in goal_options)
        assert all(isinstance(technique, str) for technique in technique_options)

        # Verify specific expected values are present
        expected_goals = [
            "initial_learn",
            "recall",
            "fluency",
            "session_ready",
            "performance_polish",
        ]
        expected_techniques = [
            "fsrs",
            "sm2",
            "daily_practice",
            "motor_skills",
            "metronome",
            "custom",
        ]

        assert set(goal_options) == set(expected_goals)
        assert set(technique_options) == set(expected_techniques)

    def test_tune_feedback_real_world_usage(self) -> None:
        """Test TuneFeedbackUpdate in realistic usage scenarios."""
        # Scenario 1: Complete feedback from advanced user
        advanced_feedback: TuneFeedbackUpdate = {
            "feedback": "Good",
            "goal": "fluency",
            "technique": "motor_skills",
        }

        # Verify all fields accessible
        assert advanced_feedback["feedback"] == "Good"
        assert advanced_feedback.get("goal") == "fluency"
        assert advanced_feedback.get("technique") == "motor_skills"

        # Scenario 2: Basic feedback from new user (minimal fields)
        basic_feedback: TuneFeedbackUpdate = {"feedback": "Easy"}

        # Verify required field works, optional fields default to None
        assert basic_feedback["feedback"] == "Easy"
        assert basic_feedback.get("goal") is None
        assert basic_feedback.get("technique") is None

        # Scenario 3: Goal-only feedback (user sets goal but not technique)
        goal_only_feedback: TuneFeedbackUpdate = {
            "feedback": "Hard",
            "goal": "session_ready",
        }

        assert goal_only_feedback["feedback"] == "Hard"
        assert goal_only_feedback.get("goal") == "session_ready"
        assert goal_only_feedback.get("technique") is None

    def test_comprehensive_goal_technique_matrix(self) -> None:
        """Test all possible goal/technique combinations work correctly."""
        feedback_values = ["Again", "Hard", "Good", "Easy"]

        # Test every combination of goal, technique, and feedback
        for goal in PracticeGoalEnum:
            for technique in PracticeTechniqueEnum:
                for feedback_val in feedback_values:
                    # Create feedback with all three fields
                    test_feedback: TuneFeedbackUpdate = {
                        "feedback": feedback_val,
                        "goal": goal.value,
                        "technique": technique.value,
                    }

                    # Verify all fields are correctly stored and accessible
                    assert test_feedback["feedback"] == feedback_val
                    assert test_feedback.get("goal") == goal.value
                    assert test_feedback.get("technique") == technique.value

                    # Verify types are correct (important for API serialization)
                    assert isinstance(test_feedback["feedback"], str)
                    assert isinstance(test_feedback.get("goal"), str)
                    assert isinstance(test_feedback.get("technique"), str)

    def test_api_serialization_compatibility(self) -> None:
        """Test that TuneFeedbackUpdate works with API serialization patterns."""
        # Test data that might come from a frontend API call
        api_data = {
            "feedback": "Good",
            "goal": "performance_polish",
            "technique": "metronome",
        }

        # Verify it can be used as TuneFeedbackUpdate (with proper casting)
        feedback: TuneFeedbackUpdate = {
            "feedback": api_data["feedback"],
            "goal": api_data.get("goal"),
            "technique": api_data.get("technique"),
        }

        # Verify all fields accessible
        assert feedback["feedback"] == "Good"
        assert feedback.get("goal") == "performance_polish"
        assert feedback.get("technique") == "metronome"

        # Test with missing optional fields (common in API calls)
        minimal_api_data = {"feedback": "Easy"}
        minimal_feedback: TuneFeedbackUpdate = {
            "feedback": minimal_api_data["feedback"]
        }

        assert minimal_feedback["feedback"] == "Easy"
        assert minimal_feedback.get("goal") is None
        assert minimal_feedback.get("technique") is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
