"""Tests for practice goals and techniques functionality (Issue #205)."""

import pytest
from fsrs import Rating

# Import the public function from the calculate module, not the private one
from tunetrees.app.schedule import (
    TuneFeedbackUpdate,
    get_default_technique_for_user,
    quality_to_fsrs_rating,
    quality_to_fsrs_rating_direct,
    fsrs_rating_to_quality,
    fsrs_rating_to_quality_direct,
    get_quality_value_bounds,
    is_4_value_quality_system,
    get_appropriate_quality_mapping_function,
    normalize_quality_for_scheduler,
)
from tunetrees.models.tunetrees_pydantic import (
    PracticeGoalEnum,
    PracticeTechniqueEnum,
)
from tunetrees.models.quality import (
    quality_lookup,
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


class TestQualityMappingSystem:
    """Test the new quality mapping system for FSRS and SM2."""

    def test_quality_lookup_contains_both_systems(self) -> None:
        """Test that quality_lookup contains both SM2 and FSRS values."""
        # SM2 6-value system
        assert quality_lookup["blackout"] == 0
        assert quality_lookup["failed"] == 1
        assert quality_lookup["barely"] == 2
        assert quality_lookup["struggled"] == 3
        assert quality_lookup["trivial"] == 4
        assert quality_lookup["perfect"] == 5

        # FSRS 4-value system
        assert quality_lookup["again"] == 0
        assert quality_lookup["hard"] == 1
        assert quality_lookup["good"] == 2
        assert quality_lookup["easy"] == 3

    def test_sm2_quality_mapping_to_fsrs_rating(self) -> None:
        """Test SM2 6-value to FSRS Rating mapping."""
        # Test traditional 6-value mapping
        assert quality_to_fsrs_rating(0) == Rating.Again  # blackout
        assert quality_to_fsrs_rating(1) == Rating.Again  # failed
        assert quality_to_fsrs_rating(2) == Rating.Hard  # barely
        assert quality_to_fsrs_rating(3) == Rating.Good  # struggled
        assert quality_to_fsrs_rating(4) == Rating.Easy  # trivial
        assert quality_to_fsrs_rating(5) == Rating.Easy  # perfect

    def test_fsrs_quality_mapping_direct(self) -> None:
        """Test FSRS 4-value direct mapping."""
        # Test direct 4-value mapping
        assert quality_to_fsrs_rating_direct(0) == Rating.Again
        assert quality_to_fsrs_rating_direct(1) == Rating.Hard
        assert quality_to_fsrs_rating_direct(2) == Rating.Good
        assert quality_to_fsrs_rating_direct(3) == Rating.Easy

    def test_fsrs_rating_to_quality_mappings(self) -> None:
        """Test FSRS Rating back to quality mappings."""
        # Test legacy 6-value mapping
        assert fsrs_rating_to_quality(Rating.Again) == 0
        assert fsrs_rating_to_quality(Rating.Hard) == 2
        assert fsrs_rating_to_quality(Rating.Good) == 3
        assert fsrs_rating_to_quality(Rating.Easy) == 5

        # Test direct 4-value mapping
        assert fsrs_rating_to_quality_direct(Rating.Again) == 0
        assert fsrs_rating_to_quality_direct(Rating.Hard) == 1
        assert fsrs_rating_to_quality_direct(Rating.Good) == 2
        assert fsrs_rating_to_quality_direct(Rating.Easy) == 3

    def test_quality_value_bounds(self) -> None:
        """Test quality value bounds for different techniques."""
        # SM2 uses 6-value system (0-5)
        assert get_quality_value_bounds("sm2") == (0, 5)

        # FSRS and goal-specific techniques use 4-value system (0-3)
        assert get_quality_value_bounds("fsrs") == (0, 3)
        assert get_quality_value_bounds("motor_skills") == (0, 3)
        assert get_quality_value_bounds("metronome") == (0, 3)
        assert get_quality_value_bounds("daily_practice") == (0, 3)
        assert get_quality_value_bounds(None) == (0, 3)  # Default

    def test_4_value_quality_system_detection(self) -> None:
        """Test detection of 4-value vs 6-value quality systems."""
        # SM2 uses 6-value system
        assert not is_4_value_quality_system("sm2")

        # Everything else uses 4-value system
        assert is_4_value_quality_system("fsrs")
        assert is_4_value_quality_system("motor_skills")
        assert is_4_value_quality_system("metronome")
        assert is_4_value_quality_system("daily_practice")
        assert is_4_value_quality_system(None)  # Default

    def test_appropriate_quality_mapping_function_selection(self) -> None:
        """Test selection of appropriate quality mapping function."""
        # SM2 should use traditional mapping
        mapping_func = get_appropriate_quality_mapping_function("sm2")
        assert mapping_func == quality_to_fsrs_rating

        # FSRS and others should use direct mapping
        mapping_func = get_appropriate_quality_mapping_function("fsrs")
        assert mapping_func == quality_to_fsrs_rating_direct

        mapping_func = get_appropriate_quality_mapping_function("motor_skills")
        assert mapping_func == quality_to_fsrs_rating_direct

        mapping_func = get_appropriate_quality_mapping_function(None)
        assert mapping_func == quality_to_fsrs_rating_direct

    def test_normalize_quality_for_scheduler(self) -> None:
        """Test quality normalization for scheduler."""
        # With the new technique-aware system, quality values are passed through
        # directly since the technique column tells us which system they're in

        # Test SM2 6-value system (pass-through)
        assert normalize_quality_for_scheduler(0, "sm2") == 0
        assert normalize_quality_for_scheduler(2, "sm2") == 2
        assert normalize_quality_for_scheduler(5, "sm2") == 5

        # Test FSRS 4-value system (pass-through)
        assert normalize_quality_for_scheduler(0, "fsrs") == 0
        assert normalize_quality_for_scheduler(1, "fsrs") == 1
        assert normalize_quality_for_scheduler(2, "fsrs") == 2
        assert normalize_quality_for_scheduler(3, "fsrs") == 3

        # Test goal-specific techniques (pass-through)
        assert normalize_quality_for_scheduler(0, "motor_skills") == 0
        assert normalize_quality_for_scheduler(1, "motor_skills") == 1
        assert normalize_quality_for_scheduler(2, "metronome") == 2
        assert normalize_quality_for_scheduler(3, "metronome") == 3

    def test_quality_mapping_error_handling(self) -> None:
        """Test error handling in quality mapping functions."""
        # Test invalid quality values
        with pytest.raises(ValueError, match="Unexpected quality value"):
            quality_to_fsrs_rating(6)

        with pytest.raises(
            ValueError, match="Unexpected quality value for 4-value system"
        ):
            quality_to_fsrs_rating_direct(4)

        with pytest.raises(
            ValueError, match="Unexpected quality value for 4-value system"
        ):
            quality_to_fsrs_rating_direct(-1)


class TestQualityMappingIntegration:
    """Integration tests for quality mapping with practice goals."""

    def test_fsrs_quality_values_in_feedback(self) -> None:
        """Test that FSRS quality values work with TuneFeedbackUpdate."""
        # Test FSRS feedback values
        feedback_again: TuneFeedbackUpdate = {
            "feedback": "again",
            "goal": "recall",
            "technique": "fsrs",
        }
        assert quality_lookup[feedback_again["feedback"]] == 0

        feedback_easy: TuneFeedbackUpdate = {
            "feedback": "easy",
            "goal": "fluency",
            "technique": "fsrs",
        }
        assert quality_lookup[feedback_easy["feedback"]] == 3

    def test_sm2_quality_values_in_feedback(self) -> None:
        """Test that SM2 quality values work with TuneFeedbackUpdate."""
        # Test SM2 feedback values
        feedback_blackout: TuneFeedbackUpdate = {
            "feedback": "blackout",
            "goal": "recall",
            "technique": "sm2",
        }
        assert quality_lookup[feedback_blackout["feedback"]] == 0

        feedback_perfect: TuneFeedbackUpdate = {
            "feedback": "perfect",
            "goal": "recall",
            "technique": "sm2",
        }
        assert quality_lookup[feedback_perfect["feedback"]] == 5

    def test_goal_specific_quality_integration(self) -> None:
        """Test goal-specific techniques with FSRS-style quality values."""
        goals = ["initial_learn", "fluency", "session_ready", "performance_polish"]
        techniques = ["motor_skills", "metronome", "daily_practice"]

        for goal in goals:
            for technique in techniques:
                feedback: TuneFeedbackUpdate = {
                    "feedback": "good",
                    "goal": goal,
                    "technique": technique,
                }
                # Should map to quality value 2 (FSRS "good")
                assert quality_lookup[feedback["feedback"]] == 2


class TestDefaultTechniqueSelection:
    """Test default technique selection based on user preferences."""

    def test_get_default_technique_for_user_requires_db(self) -> None:
        """Test that get_default_technique_for_user requires database access."""
        # Note: This is a placeholder test since get_default_technique_for_user
        # requires database access to fetch user preferences.
        # In a real integration test, we would set up a test database,
        # create a user with preferences, and test the function.

        # For now, we just test that the function exists and is importable
        assert callable(get_default_technique_for_user)

    def test_technique_fallback_logic(self) -> None:
        """Test the logic for technique fallback when not provided."""
        # Test the conceptual logic that would be used:
        # If technique is None -> get user's algorithm preference -> default to that technique

        # Test that we can determine technique from feedback
        feedback_with_technique: TuneFeedbackUpdate = {
            "feedback": "good",
            "technique": "fsrs",
        }
        assert feedback_with_technique.get("technique") == "fsrs"

        feedback_without_technique: TuneFeedbackUpdate = {
            "feedback": "good",
        }
        assert feedback_without_technique.get("technique") is None

        # In the actual system, when technique is None,
        # get_default_technique_for_user would be called


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
