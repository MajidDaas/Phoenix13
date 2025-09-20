# backend/models.py
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime

@dataclass
class Candidate:
    id: int
    name: str
    photo: str
    bio: str
    activity: int
    field_of_activity: str
    biography: str = ""
    full_name: str = ""
    email: str = ""
    phone: str = ""
    place_of_birth: str = ""
    residence: str = ""
    date_of_birth: str = ""
    work: str = ""
    education: str = ""
    facebook_url: str = ""
    def to_dict(self, include_private: bool = False) -> Dict[str, Any]:
        data = asdict(self)
        private_keys = ['email', 'phone', 'place_of_birth', 'residence','full_name','date_of_birth']
        if not include_private:
            for key in private_keys:
                data.pop(key, None)
        return data

@dataclass
class Vote:
    id: str
    voter_id: str
    selected_candidates: List[int]
    executive_candidates: List[int]
    timestamp: str
    voter_name: str = ""
    voter_email: str = ""
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class VotesData:
    voter_ids: List[str]
    votes: List[Vote]
    def to_dict(self) -> Dict[str, Any]:
        return {
            "voter_ids": self.voter_ids,
            "votes": [vote.to_dict() for vote in self.votes]
        }

@dataclass
class ElectionStatus:
    def __init__(self, is_open=False, start_time=None, end_time=None):
        self.is_open = is_open
        self.start_time = start_time.isoformat() if isinstance(start_time, datetime) else start_time
        self.end_time = end_time.isoformat() if isinstance(end_time, datetime) else end_time

    def to_dict(self) -> Dict[str, Any]:
        return {
            'is_open': self.is_open,
            'start_time': self.start_time,
            'end_time': self.end_time
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ElectionStatus':
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        if isinstance(start_time, str):
            try:
                start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            except ValueError:
                start_time = None
        if isinstance(end_time, str):
            try:
                end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            except ValueError:
                end_time = None
        return cls(
            is_open=data.get('is_open', False),
            start_time=start_time,
            end_time=end_time
        )

@dataclass
class Election:
    # Fields WITHOUT defaults MUST come first
    id: str
    name: str
    description: str
    created_by: str
    created_at: str

    # Fields WITH defaults come last
    is_open: bool = False
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    # Using None as default to avoid mutable default argument pitfall
    eligible_voter_emails: List[str] = None
    admin_user_ids: List[str] = None

    def __post_init__(self):
        if self.eligible_voter_emails is None:
            self.eligible_voter_emails = []
        if self.admin_user_ids is None:
            self.admin_user_ids = []

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Election':
        data.setdefault('eligible_voter_emails', [])
        data.setdefault('admin_user_ids', [])
        return cls(**data)

    def is_user_admin(self, user_id: str) -> bool:
        return user_id in self.admin_user_ids

    def is_user_eligible_voter(self, user_email: str) -> bool:
        return user_email in self.eligible_voter_emails

    def get_status(self) -> ElectionStatus:
        return ElectionStatus(is_open=self.is_open, start_time=self.start_time, end_time=self.end_time)

    def update_status(self, status: ElectionStatus):
        self.is_open = status.is_open
        self.start_time = status.start_time
        self.end_time = status.end_time
