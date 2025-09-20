# backend/utils/data_handler.py
import json
import os
from typing import List, Any, Dict, Optional, Tuple
from config import Config
from models import Candidate, Vote, VotesData, ElectionStatus, Election

DATA_DIR = Config.DATA_FOLDER
ELECTIONS_FILE = os.path.join(DATA_DIR, 'elections.json')

def _load_json_file(filepath: str, default_data: Any) -> Any:
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: File {filepath} not found. Using default data.")
        return default_data
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {filepath}: {e}. Using default data.")
        return default_data

def _save_json_file(filepath: str, data: Any) -> bool:
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=4, default=str)
        return True
    except Exception as e:
        print(f"Error saving data to {filepath}: {e}")
        return False

def get_elections() -> List[Election]:
    data = _load_json_file(ELECTIONS_FILE, [])
    elections = []
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                try:
                    elections.append(Election.from_dict(item))
                except Exception as e:
                    print(f"Warning: Skipping invalid election data: {e}. Data: {item}")
    return elections

def save_elections(elections: List[Election]) -> bool:
    data_to_save = [e.to_dict() for e in elections]
    return _save_json_file(ELECTIONS_FILE, data_to_save)

def get_election_by_id(election_id: str) -> Optional[Election]:
    elections = get_elections()
    for e in elections:
        if e.id == election_id:
            return e
    return None

def create_election_data_structure(election_id: str) -> bool:
    try:
        election_dir = os.path.join(DATA_DIR, 'elections', election_id)
        os.makedirs(election_dir, exist_ok=True)

        candidates_file = os.path.join(election_dir, 'candidates.json')
        if not os.path.exists(candidates_file):
            _save_json_file(candidates_file, [])

        votes_file = os.path.join(election_dir, 'votes.json')
        if not os.path.exists(votes_file):
            _save_json_file(votes_file, {"voter_ids": [], "votes": []})

        status_file = os.path.join(election_dir, 'election_status.json')
        if not os.path.exists(status_file):
            default_status = ElectionStatus(is_open=False, start_time=None, end_time=None)
            _save_json_file(status_file, default_status.to_dict())

        return True
    except Exception as e:
        print(f"Error creating data structure for election {election_id}: {e}")
        return False

def _get_election_file_path(election_id: str, filename: str) -> str:
    return os.path.join(DATA_DIR, 'elections', election_id, filename)

def get_candidates(election_id: str, include_private: bool = False) -> List[Candidate]:
    CANDIDATES_FILE_FOR_ELECTION = _get_election_file_path(election_id, 'candidates.json')
    data = _load_json_file(CANDIDATES_FILE_FOR_ELECTION, [])
    if not isinstance(data, list):
        print(f"Warning: Candidates data for election {election_id} is not a list. Returning empty list.")
        return []
    candidates = []
    for item in data:
        if isinstance(item, dict):
            try:
                candidates.append(Candidate(**item))
            except TypeError as e:
                print(f"Warning: Skipping candidate item for election {election_id} due to error: {e}. Data: {item}")
    return candidates

def get_votes(election_id: str) -> VotesData:
    VOTES_FILE_FOR_ELECTION = _get_election_file_path(election_id, 'votes.json')
    data = _load_json_file(VOTES_FILE_FOR_ELECTION, {"voter_ids": [], "votes": []})
    if isinstance(data, dict) and 'votes' in data and 'voter_ids' in data:
        votes = []
        for vote_data in data.get('votes', []):
            if isinstance(vote_data, dict):
                try:
                    votes.append(Vote(**vote_data))
                except TypeError as e:
                    print(f"Warning: Skipping invalid vote data for election {election_id} due to TypeError: {e}. Data: {vote_data}")
                except Exception as e:
                    print(f"Warning: Skipping invalid vote data for election {election_id} due to unexpected error: {e}. Data: {vote_data}")
        return VotesData(voter_ids=data['voter_ids'], votes=votes)
    else:
        print(f"Warning: Votes data for election {election_id} has unexpected structure. Returning empty VotesData.")
        return VotesData(voter_ids=[], votes=[])

def save_votes(votes_data: VotesData, election_id: str) -> bool:
    if not isinstance(votes_data, VotesData):
        print("Error: save_votes called with non-VotesData object")
        return False
    VOTES_FILE_FOR_ELECTION = _get_election_file_path(election_id, 'votes.json')
    data_to_save = {
        "voter_ids": votes_data.voter_ids,
        "votes": [vote.to_dict() for vote in votes_data.votes]
    }
    return _save_json_file(VOTES_FILE_FOR_ELECTION, data_to_save)

def get_election_status(election_id: str) -> ElectionStatus:
    ELECTION_STATUS_FILE_FOR_ELECTION = _get_election_file_path(election_id, 'election_status.json')
    data = _load_json_file(ELECTION_STATUS_FILE_FOR_ELECTION, {"is_open": False})
    if isinstance(data, dict):
        try:
            return ElectionStatus.from_dict(data)
        except Exception as e:
            print(f"Warning: election_status.json for election {election_id} has invalid data structure or parsing failed: {e}. Returning default status.")
            return ElectionStatus(is_open=False)
    else:
        print(f"Warning: election_status.json content for election {election_id} is not a dict. Returning default status.")
        return ElectionStatus(is_open=False)

def save_election_status(status: ElectionStatus, election_id: str) -> bool:
    if not isinstance(status, ElectionStatus):
        print("ERROR: save_election_status called with non-ElectionStatus object")
        return False
    ELECTION_STATUS_FILE_FOR_ELECTION = _get_election_file_path(election_id, 'election_status.json')
    return _save_json_file(ELECTION_STATUS_FILE_FOR_ELECTION, status.to_dict())

def add_candidate(new_candidate_data: Dict, election_id: str) -> Tuple[bool, str]:
    try:
        CANDIDATES_FILE_FOR_ELECTION = _get_election_file_path(election_id, 'candidates.json')
        candidates_list = get_candidates(election_id, include_private=True)
        if candidates_list:
            new_id = max(candidate.id for candidate in candidates_list) + 1
        else:
            new_id = 1

        candidate_obj_data = {
            "id": new_id,
            "name": new_candidate_data.get("name", "").strip(),
            "photo": new_candidate_data.get("photo", "/images/default.jpg").strip(),
            "bio": new_candidate_data.get("bio", "").strip(),
            "biography": new_candidate_data.get("biography", "").strip(),
            "field_of_activity": new_candidate_data.get("field_of_activity", "").strip(),
            "activity": int(new_candidate_data.get("activity", 0)),
            "full_name": new_candidate_data.get("full_name", "").strip(),
            "email": new_candidate_data.get("email", "").strip(),
            "phone": new_candidate_data.get("phone", "").strip(),
            "place_of_birth": new_candidate_data.get("place_of_birth", "").strip(),
            "residence": new_candidate_data.get("residence", "").strip(),
            "date_of_birth": new_candidate_data.get("date_of_birth", "").strip(),
            "work": new_candidate_data.get("work", "").strip(),
            "education": new_candidate_data.get("education", "").strip(),
            "facebook_url": new_candidate_data.get("facebook_url", "").strip(),
        }

        if not candidate_obj_data["name"]:
             return False, "Candidate name is required."
        if not candidate_obj_data["bio"]:
             return False, "Candidate bio is required."

        try:
            new_candidate = Candidate(**candidate_obj_data)
        except Exception as e:
             return False, f"Invalid candidate data: {e}"

        candidates_list.append(new_candidate)
        candidates_dicts = [c.to_dict(include_private=True) for c in candidates_list]
        if _save_json_file(CANDIDATES_FILE_FOR_ELECTION, candidates_dicts):
            return True, f"Candidate '{candidate_obj_data['name']}' added successfully with ID {new_id}."
        else:
            return False, "Failed to save candidate data to file."
    except Exception as e:
        print(f"Error adding candidate to election {election_id}: {e}")
        return False, f"Failed to add candidate: {str(e)}"

def remove_candidate(candidate_id: int, election_id: str) -> Tuple[bool, str]:
    try:
        CANDIDATES_FILE_FOR_ELECTION = _get_election_file_path(election_id, 'candidates.json')
        candidates_list = get_candidates(election_id, include_private=True)
        original_count = len(candidates_list)
        candidates_list = [c for c in candidates_list if c.id != candidate_id]

        if len(candidates_list) < original_count:
            candidates_dicts = [c.to_dict() for c in candidates_list]
            if _save_json_file(CANDIDATES_FILE_FOR_ELECTION, candidates_dicts):
                 return True, f"Candidate with ID {candidate_id} removed successfully."
            else:
                 return False, "Failed to save updated candidate list to file."
        else:
            return False, f"Candidate with ID {candidate_id} not found."
    except Exception as e:
        print(f"Error removing candidate {candidate_id} from election {election_id}: {e}")
        return False, f"Failed to remove candidate: {str(e)}"

TRANSLATIONS_FILE = os.path.join(DATA_DIR, 'translations.json')

def load_translations():
    try:
        with open(TRANSLATIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Translation file not found: {TRANSLATIONS_FILE}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {TRANSLATIONS_FILE}: {e}")
        return {}
    except Exception as e:
        print(f"Unexpected error loading translations from {TRANSLATIONS_FILE}: {e}")
        return {}
