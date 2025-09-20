# utils/auth.py
import os
import json
from typing import Optional, Dict, Any, List
import datetime
import uuid
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import requests as http_requests

class GoogleAuth:
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = [
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ]

    def get_authorization_url(self) -> tuple[str, str]:
        """Generate Google OAuth2 authorization URL."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.scopes
        )
        flow.redirect_uri = self.redirect_uri
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        return authorization_url, state

    def exchange_code_for_tokens(self, authorization_code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access and ID tokens."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.scopes
        )
        flow.redirect_uri = self.redirect_uri
        try:
            flow.fetch_token(code=authorization_code)
            return {
                'access_token': flow.credentials.token,
                'id_token': flow.credentials.id_token,
                'refresh_token': flow.credentials.refresh_token
            }
        except Exception as e:
            print(f"Error exchanging code for tokens: {e}")
            return None

    def verify_id_token(self, id_token_str: str) -> Optional[Dict[str, Any]]:
        """Verify Google ID token and extract user information."""
        try:
            idinfo = id_token.verify_oauth2_token(
                id_token_str,
                google_requests.Request(),
                self.client_id
            )
            valid_issuers_base = ['accounts.google.com', 'https://accounts.google.com']
            if not any(idinfo['iss'].startswith(issuer) for issuer in valid_issuers_base):
                raise ValueError(f'Wrong issuer. Got: {idinfo["iss"]}')
            if idinfo['aud'] != self.client_id:
                raise ValueError('Wrong audience.')
            return {
                'user_id': idinfo['sub'],
                'email': idinfo['email'],
                'name': idinfo.get('name', ''),
                'picture': idinfo.get('picture', ''),
                'email_verified': idinfo.get('email_verified', False)
            }
        except Exception as e:
            print(f"Error verifying ID token: {e}")
            return None

    def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Get user info from Google API."""
        try:
            response = http_requests.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error getting user info: {e}")
            return None

class VoterSession:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)
        self.data_dir = os.path.join(backend_dir, 'data')
        self.sessions_file = os.path.join(self.data_dir, 'voter_sessions.json')
        self.login_log_file = os.path.join(self.data_dir, 'voter_login_log.json')
        self._load_sessions()

    def _load_sessions(self):
        """Load existing voter sessions from file."""
        try:
            with open(self.sessions_file, 'r') as f:
                self.sessions = json.load(f)
        except FileNotFoundError:
            self.sessions = {}
        except json.JSONDecodeError as e:
            print(f"Error decoding voter_sessions.json: {e}. Initializing empty sessions.")
            self.sessions = {}

    def _save_sessions(self):
        """Save voter sessions to file."""
        try:
            os.makedirs(os.path.dirname(self.sessions_file), exist_ok=True)
            with open(self.sessions_file, 'w') as f:
                json.dump(self.sessions, f, indent=2, default=str)
        except Exception as e:
            print(f"Error saving voter sessions: {e}")

    def create_session(self, user_id: str, email: str, name: str,
                       has_voted: bool = False, is_admin: bool = False,
                       is_eligible_voter: bool = True) -> str:
        """Create a new voter session."""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            'user_id': user_id,
            'email': email,
            'name': name,
            'created_at': datetime.datetime.utcnow().isoformat() + 'Z',
            'has_voted': has_voted,
            'is_admin': is_admin,
            'is_eligible_voter': is_eligible_voter
        }
        self._save_sessions()
        return session_id

    def _load_login_log(self) -> List[Dict[str, Any]]:
        """Load existing login log data from file."""
        try:
            with open(self.login_log_file, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                else:
                    print(f"Warning: {self.login_log_file} does not contain a list. Initializing empty log.")
                    return []
        except FileNotFoundError:
            return []
        except json.JSONDecodeError as e:
            print(f"Error decoding {self.login_log_file}: {e}. Initializing empty log.")
            return []

    def _save_login_log(self, log_data: List[Dict[str, Any]]) -> bool:
        """Save login log data to file."""
        try:
            os.makedirs(os.path.dirname(self.login_log_file), exist_ok=True)
            with open(self.login_log_file, 'w') as f:
                json.dump(log_data, f, indent=2, default=str)
            return True
        except Exception as e:
            print(f"Error saving login log to {self.login_log_file}: {e}")
            return False

    def log_login(self, google_user_id: str, email: str, name: str = ""):
        """
        Logs a voter login event with Google ID, email, and timestamp.
        This creates a static record of each login attempt.
        """
        try:
            log_entries = self._load_login_log()
            new_entry = {
                "google_id": google_user_id,
                "email": email,
                "name": name,
                "login_timestamp": datetime.datetime.utcnow().isoformat() + 'Z'
            }
            log_entries.append(new_entry)
            success = self._save_login_log(log_entries)
            if success:
                print(f"Logged login for Google ID: {google_user_id}, Email: {email}")
            else:
                print(f"Failed to log login for Google ID: {google_user_id}")
        except Exception as e:
            print(f"Error in log_login: {e}")

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID."""
        return self.sessions.get(session_id)

    def update_session(self, session_id: str, **kwargs):
        """Update session fields."""
        if session_id in self.sessions:
            self.sessions[session_id].update(kwargs)
            self._save_sessions()

    def delete_session(self, session_id: str):
        """Delete a session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            self._save_sessions()

