// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @title AmbAG
/// @notice Group-buy collection with a target, deadline, fixed vendor, and pull refunds.
/// @dev Deploy once, create one collection per group buy. No admin, no fees, no upgradeability.
contract AmbAG {
    struct Collection {
        address organizer;
        address payable vendor;
        uint256 target;
        uint256 deadline;
        uint256 totalRaised;
        bool released;
    }

    struct Contribution {
        address contributor;
        bytes32 ref;
        uint256 amount;
    }

    uint256 public collectionCount;
    mapping(uint256 => Collection) public collections;
    mapping(uint256 => Contribution[]) private _contributions;
    mapping(uint256 => mapping(address => uint256)) public contributed;

    uint256 private _lock = 1;

    event CollectionCreated(
        uint256 indexed id,
        address indexed organizer,
        address indexed vendor,
        uint256 target,
        uint256 deadline
    );
    event ContributionMade(
        uint256 indexed id,
        address indexed contributor,
        bytes32 ref,
        uint256 amount
    );
    event Released(uint256 indexed id, address indexed vendor, uint256 amount);
    event Refunded(uint256 indexed id, address indexed contributor, uint256 amount);

    modifier nonReentrant() {
        require(_lock == 1, "reentrant");
        _lock = 2;
        _;
        _lock = 1;
    }

    function createCollection(
        address payable vendor,
        uint256 target,
        uint256 deadline
    ) external returns (uint256 id) {
        require(vendor != address(0) && vendor != address(this), "bad vendor");
        require(target > 0, "bad target");
        require(deadline > block.timestamp, "bad deadline");
        id = ++collectionCount;
        collections[id] = Collection(msg.sender, vendor, target, deadline, 0, false);
        emit CollectionCreated(id, msg.sender, vendor, target, deadline);
    }

    function contribute(uint256 id, bytes32 ref) external payable {
        Collection storage c = collections[id];
        require(c.organizer != address(0), "no collection");
        require(!c.released, "released");
        require(block.timestamp < c.deadline, "closed");
        require(msg.value > 0, "zero value");
        c.totalRaised += msg.value;
        contributed[id][msg.sender] += msg.value;
        _contributions[id].push(Contribution(msg.sender, ref, msg.value));
        emit ContributionMade(id, msg.sender, ref, msg.value);
    }

    function release(uint256 id) external nonReentrant {
        Collection storage c = collections[id];
        require(c.organizer != address(0), "no collection");
        require(!c.released, "released");
        require(c.totalRaised >= c.target, "target not met");
        c.released = true;
        uint256 amount = c.totalRaised;
        (bool ok, ) = c.vendor.call{value: amount}("");
        require(ok, "send failed");
        emit Released(id, c.vendor, amount);
    }

    function claimRefund(uint256 id) external nonReentrant {
        Collection storage c = collections[id];
        require(c.organizer != address(0), "no collection");
        require(!c.released, "released");
        require(block.timestamp >= c.deadline, "not ended");
        require(c.totalRaised < c.target, "target met");
        uint256 amount = contributed[id][msg.sender];
        require(amount > 0, "nothing to refund");
        contributed[id][msg.sender] = 0;
    c.totalRaised -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "send failed");
        emit Refunded(id, msg.sender, amount);
    }

    function contributionsOf(uint256 id) external view returns (Contribution[] memory) {
        return _contributions[id];
    }
}
