from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models import Q


class Role(models.TextChoices):
    RESIDENT = 'resident'
    ORG = 'org'
    ADMIN = 'admin'


class UserManager(BaseUserManager):
    def create_user(self, email, password, display_name, role=Role.RESIDENT):
        user = self.model(email=self.normalize_email(email).lower(), display_name=display_name, role=role)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_guest(self, display_name):
        user = self.model(email=None, display_name=display_name, role=Role.RESIDENT, is_guest=True)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, display_name='Administrator'):
        return self.create_user(email, password, display_name, role=Role.ADMIN)


class User(AbstractBaseUser):
    email = models.EmailField(unique=True, null=True, blank=True)
    password = models.CharField(db_column='password_hash', max_length=255)
    display_name = models.CharField(max_length=60)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.RESIDENT)
    is_guest = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(db_column='last_login_at', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['display_name']

    class Meta:
        db_table = 'accounts_user'
        constraints = [
            models.CheckConstraint(
                condition=Q(is_guest=True) | (Q(email__isnull=False) & ~Q(password='')),
                name='user_registered_has_credentials',
            ),
            models.CheckConstraint(condition=Q(is_guest=False) | Q(role='resident'), name='user_guest_is_resident'),
        ]


class OrganizationKind(models.TextChoices):
    NGO = 'ngo'
    FOUNDATION = 'foundation'
    ASSOCIATION = 'association'
    CITY_OFFICE = 'city_office'
    DISTRICT_COUNCIL = 'district_council'
    MUNICIPALITY = 'municipality'
    OTHER = 'other'


class VerificationStatus(models.TextChoices):
    PENDING = 'pending'
    VERIFIED = 'verified'
    SUSPENDED = 'suspended'


class Organization(models.Model):
    name = models.CharField(max_length=150, unique=True)
    kind = models.CharField(max_length=20, choices=OrganizationKind.choices)
    krs = models.CharField(max_length=10, null=True, blank=True)
    contact_person = models.CharField(max_length=100, null=True, blank=True)
    contact_email = models.EmailField(null=True, blank=True)
    contact_phone = models.CharField(max_length=30, null=True, blank=True)
    verification_status = models.CharField(max_length=10, choices=VerificationStatus.choices, default=VerificationStatus.PENDING)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_organization'
        constraints = [
            models.CheckConstraint(
                condition=(Q(verification_status='verified') & Q(verified_at__isnull=False))
                | (~Q(verification_status='verified') & Q(verified_at__isnull=True)),
                name='organization_verified_has_date',
            ),
        ]

    @property
    def is_verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED


class MemberRole(models.TextChoices):
    OWNER = 'owner'
    EDITOR = 'editor'


class OrganizationMember(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    member_role = models.CharField(max_length=10, choices=MemberRole.choices, default=MemberRole.EDITOR)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_organization_member'
        constraints = [models.UniqueConstraint(fields=['organization', 'user'], name='organization_member_unique')]
